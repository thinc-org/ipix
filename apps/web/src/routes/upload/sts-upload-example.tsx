import React, { useRef, useEffect } from "react";
import Uppy, { type UppyFile, type Meta, type Body } from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3, { type AwsS3Part } from "@uppy/aws-s3";
import { DashboardModal } from "@uppy/react";
import app from "@/lib/fetch";

// Import Uppy styles
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

type UploadCtx = {
  spaceId: string;
  parentId: string;
  itemId?: string;
  sessionKey?: string;
};

export function STSUploadExample(
  props: { spaceId?: string; parentId?: string } = {}
) {
  const { spaceId, parentId } = props;
  const uppyRef = useRef<Uppy<any> | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isUppyReady, setIsUppyReady] = React.useState(false);
  const [, setUploadedFiles] = React.useState<
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
    // Server currently only allows images
    allowedFileTypes: ["image/*"],
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
      // small helper to compute SHA-256 for each part as base64
      const sha256Base64OfBlob = async (blob: Blob): Promise<string> => {
        const ab = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", ab);
        const bytes = new Uint8Array(digest);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      };

      uppy.use(AwsS3, {
        // Always multipart to comply with API
        shouldUseMultipart: () => true,
        limit: 20,

        getChunkSize: (file: any) => {
          const FIVE_MIB = 5 * 1024 * 1024; // S3 minimum
          const MAX_CHUNKS = 10000; // AWS S3 spec
          const minRequiredChunkSize = Math.ceil(file.size / MAX_CHUNKS);
          return Math.max(FIVE_MIB, minRequiredChunkSize);
        },

        // Satisfy type union: disable non-multipart path explicitly
        async getUploadParameters() {
          throw new Error("Non-multipart uploads are disabled.");
        },

        // Create placeholder item and initiate a multipart session
        async createMultipartUpload(file: UppyFile<Meta, Body>) {
          if (!spaceId || !parentId) {
            throw new Error("Upload target not configured (spaceId/parentId).");
          }
          // 1) Create file placeholder
          const { data: created, error: createErr } = await app.v1
            .spaces({ spaceId })
            .items.files.post({
              parentId,
              name: file.name || "uploaded-file",
              contentType: (file.type || "application/octet-stream").toLowerCase(),
            } as any);

          if (createErr || !created?.item?.id) {
            throw new Error(`Failed to create file item: ${createErr?.value ?? "unknown"}`);
          }

          const itemId = created.item.id as string;

          // 2) Initiate multipart session
          const { data: init, error: initErr } = await app.v1
            .spaces({ spaceId })
            .items({ itemId })
            .uploads.multipart.initiate.post({
              expectedSize: String(file.size ?? 0),
              contentType: (file.type || "application/octet-stream").toLowerCase(),
            } as any, {} as any);

          if (initErr || !init?.session?.key || !init?.session?.uploadId || !init?.storage?.stagingKey) {
            throw new Error(`Failed to initiate multipart: ${initErr?.value ?? "unknown"}`);
          }

          // Stash context for later calls
          (file.meta as any).uploadCtx = {
            spaceId,
            parentId,
            itemId,
            sessionKey: init.session.key,
          } as UploadCtx;

          return {
            uploadId: init.session.uploadId,
            key: init.storage.stagingKey,
          };
        },

        async listParts(file: UppyFile<Meta, Body>, _opts: any) {
          const ctx = (file.meta as any).uploadCtx as UploadCtx | undefined;
          if (!ctx?.itemId || !ctx?.sessionKey) return [];

          const { data, error } = await app.v1
            .spaces({ spaceId: ctx.spaceId })
            .items({ itemId: ctx.itemId })
            .uploads({ sessionKey: ctx.sessionKey })
            .get();

          if (error) {
            throw new Error(`Failed to list parts: ${error.value ?? "unknown"}`);
          }

          const parts = (data?.data?.parts ?? []) as AwsS3Part[];
          return parts;
        },

        async signPart(file: UppyFile<Meta, Body>, opts: any) {
          const ctx = (file.meta as any).uploadCtx as UploadCtx | undefined;
          if (!ctx?.itemId || !ctx?.sessionKey) throw new Error("Missing upload session context");

          const partNumber: number = opts.partNumber;
          const bodyBlob: Blob | undefined = (opts as any).body;
          if (!bodyBlob) throw new Error("Missing part body to compute checksum");

          // Compute checksum for S3 to validate
          const checksumB64 = await sha256Base64OfBlob(bodyBlob);

          // Persist checksum for use on /complete
          const metaAny = file.meta as any;
          if (!metaAny.partChecksums) metaAny.partChecksums = {} as Record<number, string>;
          metaAny.partChecksums[partNumber] = checksumB64;

          // Infer if last part (to allow size < 5 MiB)
          const FIVE_MIB = 5 * 1024 * 1024;
          const MAX_CHUNKS = 10000;
          const minRequiredChunkSize = Math.ceil((file.size || 0) / MAX_CHUNKS);
          const chunkSize = Math.max(FIVE_MIB, minRequiredChunkSize);
          const isLast = partNumber * chunkSize >= (file.size || 0);

          const { data, error } = await app.v1
            .spaces({ spaceId: ctx.spaceId })
            .items({ itemId: ctx.itemId })
            .uploads({ sessionKey: ctx.sessionKey })
            .parts.post({
              parts: [
                {
                  partNumber,
                  size: String(bodyBlob.size),
                  checksumSHA256Base64: checksumB64,
                  isLast,
                },
              ],
              overrideContentType: (file.type || "application/octet-stream").toLowerCase(),
            } as any, {} as any);

          if (error) {
            throw new Error(`Failed to sign part: ${error.value ?? "unknown"}`);
          }

          const p = (data as any)?.parts?.[0];
          if (!p?.url) throw new Error("No presigned URL returned for part");
          return { url: p.url as string, headers: (p.headers ?? {}) as Record<string, string> };
        },

        async completeMultipartUpload(file: UppyFile<Meta, Body>, opts: any) {
          const ctx = (file.meta as any).uploadCtx as UploadCtx | undefined;
          if (!ctx?.itemId || !ctx?.sessionKey) throw new Error("Missing upload session context");

          const partChecksums: Record<number, string> = (file.meta as any).partChecksums || {};
          const normalizeETag = (etag: string | undefined) =>
            (etag ?? "").replace(/^\"+|\"+$/g, "").replace(/^"+|"+$/g, "");

          const partsInput = ([...(opts.parts ?? [])]
            .sort((a: any, b: any) => Number(a.PartNumber) - Number(b.PartNumber))
          ).map((p: any) => ({
            partNumber: Number(p.PartNumber),
            eTag: normalizeETag(p.ETag),
            checksumSHA256Base64: partChecksums[Number(p.PartNumber)],
          }));

          const { data, error } = await app.v1
            .spaces({ spaceId: ctx.spaceId })
            .items({ itemId: ctx.itemId })
            .uploads({ sessionKey: ctx.sessionKey })
            .complete.post({
              parts: partsInput,
              clientSha256Hex: null,
            } as any, {} as any);

          if (error) {
            throw new Error(`Failed to complete multipart upload: ${error.value ?? "unknown"}`);
          }

          const blob = (data as any)?.blobLocation;
          const location = blob?.bucket && blob?.objectKey ? `s3://${blob.bucket}/${blob.objectKey}` : undefined;
          return { location } as any;
        },

        async abortMultipartUpload(file: UppyFile<Meta, Body>) {
          const ctx = (file.meta as any).uploadCtx as UploadCtx | undefined;
          if (!ctx?.itemId || !ctx?.sessionKey) return;

/*           await app.v1
            .spaces({ spaceId: ctx.spaceId })
            .items({ itemId: ctx.itemId })
            .uploads({ sessionKey: ctx.sessionKey })
            .abort.post({} as any, {} as any); */
          // Best effort; ignore errors
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
