import React, { useRef, useEffect } from 'react'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import AwsS3 from '@uppy/aws-s3'
import { DashboardModal } from '@uppy/react'
import { authClient } from "@/lib/better-auth/auth-client";
import { type UppyFileMetadata as FileMetadata } from '@repo/shared'

// Import Uppy styles
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'



// API base URL
const API_BASE_URL = process.env.API_BASE_URL

export function S3UploadPage() {
  const uppyRef = useRef<Uppy<FileMetadata> | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
    id: string
    name: string
    location?: string
    size: number
    type: string
  }>>([])
  const [isUppyReady, setIsUppyReady] = React.useState(false)
  // Initialize Uppy instance only on client side
  useEffect(() => {

    if (uppyRef.current) {
      return // Already initialized
    }

    const uppy = new Uppy<FileMetadata>({
      meta: { name: '', description: '' },
      restrictions: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxNumberOfFiles: 10,
        allowedFileTypes: ['image/*', 'video/*', '.pdf', '.doc', '.docx']
      },
      autoProceed: false,
    })

    // Use try-catch to handle potential plugin conflicts in React strict mode
    try {
      uppy.use(Dashboard, {
        inline: false,
        proudlyDisplayPoweredByUppy: false,
        showLinkToFileUploadResult: true,
        showProgressDetails: true,
        note: 'Images, videos, and documents up to 100MB',
        metaFields: [
          { id: 'name', name: 'Name', placeholder: 'File name' },
          { id: 'description', name: 'Description', placeholder: 'Describe what this file is about' }
        ],
        theme: 'auto',
        closeAfterFinish: false,
        closeModalOnClickOutside: true
      })
    } catch (error) {
      // Handle plugin already registered error in React strict mode
      if (!(error as Error).message.includes('Already found a plugin')) {
        throw error
      }
    }

    try {
      uppy.use(AwsS3, {
        shouldUseMultipart: (file: any) => (file.size || 0) > 50 * 1024 * 1024, // 50MB threshold
        limit: 8, // Higher concurrency for batch uploads
        
        // Batch-optimized upload parameters
        async getUploadParameters(file: any) {
          const session = await authClient.getSession();
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-sign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
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
          const session = await authClient.getSession();
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
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
          const session = await authClient.getSession();
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
            },
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
          const session = await authClient.getSession();
          
          const response = await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}/complete?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
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
          const session = await authClient.getSession();
          
          await fetch(`${API_BASE_URL}/s3/batch-multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${session?.data?.session?.token || ''}`,
            },
          });
          // Note: We don't throw on failure here as abort should be best-effort
        }
      });
    } catch (error) {
      // Handle plugin already registered error in React strict mode
      if (!(error as Error).message.includes('Already found a plugin')) {
        throw error
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

    uppyRef.current = uppy
    setIsUppyReady(true)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (uppyRef.current) {
        uppyRef.current.destroy()
        uppyRef.current = null
      }
    }
  }, [])

  const openModal = () => {
    if (isUppyReady && uppyRef.current) {
      setIsModalOpen(true)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const clearUploadedFiles = () => {
    setUploadedFiles([])
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            File Upload
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload your files directly to AWS S3 with multipart support for large files
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex justify-center">
          <button
            onClick={openModal}
            disabled={!isUppyReady}
            className={`font-medium py-3 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center space-x-2 ${
              isUppyReady 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <span>{isUppyReady ? 'Choose Files to Upload' : 'Loading...'}</span>
          </button>
        </div>

        {/* Upload Modal */}
        {isUppyReady && uppyRef.current && (
          <DashboardModal
            uppy={uppyRef.current}
            open={isModalOpen}
            onRequestClose={closeModal}
          />
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Uploaded Files ({uploadedFiles.length})
              </h2>
              <button
                onClick={clearUploadedFiles}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {file.type.startsWith('image/') ? (
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)} • {file.type}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Uploaded
                    </span>
                    
                    {file.location && (
                      <a
                        href={file.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Utility function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}