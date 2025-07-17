import React, { useRef, useEffect } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import { DashboardModal } from "@uppy/react";
import { authClient } from "@/lib/better-auth/auth-client";

// Import Uppy styles
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

// API base URL
const API_BASE_URL = "http://localhost:20257";

export function STSUploadExample() {
  const uppyRef = useRef<Uppy<any> | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isUppyReady, setIsUppyReady] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
    id: string
    name: string
    location?: string
    size: number
    type: string
  }>>([])

  // Initialize Uppy instance with batch-optimized configuration for faculty photos
  useEffect(() => {
    if (uppyRef.current) {
      return; // Already initialized
    }

    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 500 * 1024 * 1024, // 500MB for large file testing
        maxNumberOfFiles: 5,
        allowedFileTypes: ["image/*", "video/*", ".pdf", ".doc", ".docx"],
      },
      autoProceed: false,
    });

    // Use try-catch to handle potential plugin conflicts in React strict mode
    try {
      uppy.use(Dashboard, {
        inline: false,
        proudlyDisplayPoweredByUppy: true,
        showProgressDetails: true,
        note: "Batch-optimized uploads for faculty photos (~30% faster for large batches)",
        theme: "auto",
      });
    } catch (error) {
      // Handle plugin already registered error in React strict mode
      if (!(error as Error).message.includes("Already found a plugin")) {
        throw error;
      }
    }

    try {
      uppy.use(AwsS3, {
        shouldUseMultipart: (file: any) => (file.size || 0) > 50 * 1024 * 1024, // 50MB threshold
        limit: 20, // Higher concurrency for batch uploads

        getChunkSize: (file: any) => {
          const TEN_MIB = 10 * 1024 * 1024 // Actual minimum is 5 MiB but 10 MiB is used here to reduce overhead, considering Thailand's internet speed.
          const MAX_CHUNKS = 10000 // per MinIO S3 / AWS S3 Specs

          const minRequiredChunkSize = Math.ceil(file.size / MAX_CHUNKS)

          const chunkSize = Math.max(TEN_MIB, minRequiredChunkSize)

          return chunkSize
        },
        
        // Batch-optimized upload parameters
        async getUploadParameters(file: any) {
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-sign`, {
            method: 'POST',
            credentials: "include",
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              type: file.type || 'image/jpeg',
              size: file.size,
              // Add batch context for faculty photos
              context: 'faculty-photos',
              timestamp: new Date().toISOString().slice(0, 10),
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to get upload parameters: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          return {
            method: data.method || 'PUT',
            url: data.url,
            fields: data.fields || {},
            headers: {
              'Content-Type': file.type || 'image/jpeg',
              ...(data.headers || {}),
            }
          };
        },

        // Batch multipart upload methods (for large files)
        async createMultipartUpload(file: any) {
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              type: file.type || 'image/jpeg',
              size: file.size,
              context: 'faculty-photos',
              metadata: {
                originalName: file.name,
                uploadedBy: 'faculty-photographer',
                batchId: Date.now().toString(),
                ...file.meta
              }
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create multipart upload: ${response.statusText}`);
          }

          const data = await response.json();
          return {
            uploadId: data.uploadId,
            key: data.key
          };
        },

        async listParts(_file: any, opts: any) {
          const { uploadId, key } = opts;
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
            method: 'GET',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`Failed to list parts: ${response.statusText}`);
          }

          return await response.json();
        },

        async signPart(_file: any, opts: any) {
          const { uploadId, key, partNumber } = opts;
          const session = await authClient.getSession();
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}/${partNumber}?key=${encodeURIComponent(key)}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to sign part: ${response.statusText}`);
          }

          const data = await response.json();
          return {
            url: data.url
          };
        },

        async completeMultipartUpload(_file: any, opts: any) {
          const { uploadId, key, parts } = opts;
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}/complete?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ parts }),
          });

          if (!response.ok) {
            throw new Error(`Failed to complete multipart upload: ${response.statusText}`);
          }

          const data = await response.json();
          return {
            location: data.location
          };
        },

        async abortMultipartUpload(_file: any, opts: any) {
          const { uploadId, key } = opts;
          
          await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          // Note: We don't throw on failure here as abort should be best-effort
        }
      });
    } catch (error) {
      // Handle plugin already registered error in React strict mode
      if (!(error as Error).message.includes("Already found a plugin")) {
        throw error;
      }
    }

    // Event listeners
    uppy.on('complete', (result) => {
      if (result.successful) {
        const newUploadedFiles = result.successful.map(file => ({
          id: file.id,
          name: file.name || 'Unknown file',
          location: file.response?.body?.location,
          size: file.size || 0,
          type: file.type || 'application/octet-stream'
        }))
        
        setUploadedFiles(prev => [...prev, ...newUploadedFiles])
        
        // Show success message
        console.log('Upload complete:', result)
      }
    })

    uppy.on('upload-error', (_file, error) => {
      console.error('Upload error:', error)
    })

    uppy.on('file-added', (file) => {
      console.log('File added:', file.name)
    })

    uppy.on('file-removed', (file) => {
      console.log('File removed:', file.name)
    })

    uppyRef.current = uppy;
    setIsUppyReady(true);
  }, []);



  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (uppyRef.current) {
        uppyRef.current.destroy();
        uppyRef.current = null;
      }
    };
  }, []);

  const openModal = () => {
    if (isUppyReady && uppyRef.current) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6 rounded-lg">
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            High-Performance Upload
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Uses batch presigned URLs {'+'} MultiParts for faster uploads with less request
            overhead
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={openModal}
            disabled={!isUppyReady}
            className={`font-medium py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 ${
              isUppyReady
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {isUppyReady ? "Try STS Upload" : "Loading..."}
          </button>
        </div>

        {isUppyReady && uppyRef.current && (
          <DashboardModal
            uppy={uppyRef.current}
            open={isModalOpen}
            onRequestClose={closeModal}
          />
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Best for large files or batch uploads
        </div>
      </div>
    </div>
  );
}
