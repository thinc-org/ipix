import React, { useRef, useEffect } from "react";
import Uppy, { type UppyFile, type Meta, type Body } from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3, { type AwsS3Part, type AwsS3UploadParameters } from "@uppy/aws-s3";
import { DashboardModal } from "@uppy/react";
import app from '@/lib/fetch'

// Import Uppy styles
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

export function STSUploadExample() {
  const uppyRef = useRef<Uppy<any> | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isUppyReady, setIsUppyReady] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<
    Array<{
      id: string;
      name: string;
      location?: string;
      size: number;
      type: string;
    }>
  >([]);

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
          const TEN_MIB = 10 * 1024 * 1024; // Actual minimum is 5 MiB but 10 MiB is used here to reduce overhead, considering Thailand's internet speed.
          const MAX_CHUNKS = 10000; // per MinIO S3 / AWS S3 Specs

          const minRequiredChunkSize = Math.ceil(file.size / MAX_CHUNKS);

          const chunkSize = Math.max(TEN_MIB, minRequiredChunkSize);

          return chunkSize;
        },

        // Batch-optimized upload parameters
        async getUploadParameters(file: UppyFile<Meta, Body>) {
          const {data, error} = await app.s3["batch-sign"].post({
            filename: file.name!,
            type: file.type ?? "image/jpeg",
            size: file.size!,
            context: "",
            timestamp: new Date().toISOString().slice(0, 10)
          },{fetch: {
            credentials: "include"
          }})

          if (error || !data) {
            throw new Error(
              `Failed to get upload parameters: ${error.value}`
            );
          }

          return {
            method: data.method ?? "PUT",
            url: data.url!,
            headers: {
              "Content-Type": file.type ?? "image/jpeg",
            },
          } as AwsS3UploadParameters;
        },

        // Batch multipart upload methods (for large files)
        async createMultipartUpload(file: UppyFile<Meta, Body>) {
          const { data, error } = await app.s3["batch-multipart"].post(
            {
              filename: file.name!,
              type: file.type ?? "image/jpeg",
              size: file.size!,
              context: "faculty-photos",
              metadata: {
                originalName: file.name,
                uploadedBy: "faculty-photographer",
                batchId: Date.now().toString(),
                ...file.meta,
              },
            },
            {
              fetch: {
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
              },
            }
          );

          if (error) {
            throw new Error(
              `Failed to create multipart upload: ${error.value}`
            );
          }

          return {
            uploadId: data.uploadId!,
            key: data.key!,
          };
        },

        async listParts(_file: UppyFile<Meta, Body>, opts: any) {
          const { uploadId, key } = opts;

          const { data, error } = await app.s3["batch-multipart"]({
            uploadId: uploadId,
          }).get({
            query: { key: key },
            fetch: {
              credentials: "include",
            },
          });

          if (error) {
            throw new Error(`Failed to list parts: ${error.value}`);
          }

          return data as AwsS3Part[];
        },

        async signPart(_file: UppyFile<Meta, Body>, opts: any) {
          const { uploadId, key, partNumber } = opts;

          const { data, error } = await app.s3["batch-multipart"]({
            uploadId: uploadId,
          })({ partNumber: partNumber }).get({
            query: { key: key },
            fetch: {
              credentials: "include",
            },
          });

          if (error) {
            throw new Error(`Failed to sign part: ${error.value}`);
          }

          return {
            url: data.url!,
          };
        },

        async completeMultipartUpload(_file: UppyFile<Meta, Body>, opts: any) {
          const { uploadId, key, parts } = opts;

          const { data, error } = await app.s3["batch-multipart"]({
            uploadId: uploadId,
          }).complete.post(
            {
              parts: parts,
            },
            {
              fetch: {
                credentials: "include",
              },
              query: {
                key: key,
              },
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (error) {
            throw new Error(
              `Failed to complete multipart upload: ${error.value}`
            );
          }

          return {
            location: data.location,
          };
        },

        async abortMultipartUpload(_file: UppyFile<Meta, Body>, opts: any) {
          const { uploadId, key } = opts;

          await app.s3["batch-multipart"]({ uploadId: uploadId }).delete(
            {},
            {
              fetch: {
                credentials: "include",
              },
              query: {
                key: key
              }
            }
          );
          // Note: We don't throw on failure here as abort should be best-effort
        },
      });
    } catch (error) {
      // Handle plugin already registered error in React strict mode
      if (!(error as Error).message.includes("Already found a plugin")) {
        throw error;
      }
    }

    // Event listeners
    uppy.on("complete", (result) => {
      if (result.successful) {
        const newUploadedFiles = result.successful.map((file) => ({
          id: file.id,
          name: file.name || "Unknown file",
          location: file.response?.body?.location,
          size: file.size || 0,
          type: file.type || "application/octet-stream",
        }));

        setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);

        // Show success message
        console.log("Upload complete:", result);
      }
    });

    uppy.on("upload-error", (_file, error) => {
      console.error("Upload error:", error);
    });

    uppy.on("file-added", (file) => {
      console.log("File added:", file.name);
    });

    uppy.on("file-removed", (file) => {
      console.log("File removed:", file.name);
    });

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
            Uses batch presigned URLs {"+"} MultiParts for faster uploads with
            less request overhead
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
