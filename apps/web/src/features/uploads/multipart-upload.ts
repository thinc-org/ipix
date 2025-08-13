// Helper to start multipart uploads for queued files, mirroring the Uppy flow
// Uses the same endpoints as in STSUploadExample
import app from "@/lib/fetch";
import { useTransferStore } from "@/stores/fileStores";
import { getContext as getQueryContext } from "@/integrations/tanstack-query/root-provider";

const FIVE_MIB = 5 * 1024 * 1024;
const MAX_CHUNKS = 10000; // AWS S3 spec

// Compute SHA-256 of a Blob and return Base64 string
async function sha256Base64OfBlob(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", ab);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function normalizeETag(etag: string | undefined) {
  return (etag ?? "").replace(/^\"+|\"+$/g, "").replace(/^"+|"+$/g, "");
}

function getChunkSize(fileSize: number) {
  const minRequiredChunkSize = Math.ceil(fileSize / MAX_CHUNKS);
  return Math.max(FIVE_MIB, minRequiredChunkSize);
}

export async function startUploadsForIds(spaceId: string, parentId: string, ids: string[]) {
  const store = useTransferStore.getState();
  for (const id of ids) {
    const u = store.uploads[id];
    if (!u) continue;
    try {
      await uploadSingleFile(spaceId, parentId, id);
    } catch (e: any) {
      const isAbort = e?.name === "AbortError" || e?.message?.includes("aborted");
      store.setUploadStatus(id, isAbort ? "canceled" : "error", e?.message);
    }
  }
}

async function uploadSingleFile(spaceId: string, parentId: string, id: string) {
  const store = useTransferStore.getState();
  const u = store.uploads[id];
  if (!u) return;

  const file = u.file;
  const fileSize = file.size || 0;
  const controller = new AbortController();
  store.setUploadCancel(id, () => controller.abort());
  store.setUploadStatus(id, "uploading");
  store.setUploadProgress(id, 0);

  // 1) Create file placeholder
  const contentType = (file.type || "application/octet-stream").toLowerCase();
  const { data: created, error: createErr } = await app.v1
    .spaces({ spaceId })
    .items.files.post({
      parentId,
      name: file.name || "uploaded-file",
      contentType,
    } as any);

  if (createErr || !(created as any)?.item?.id) {
    throw new Error(`Failed to create file item: ${createErr?.value ?? "unknown"}`);
  }

  const item = (created as any).item as any;
  const itemId = item.id as string;

  // Optimistically add the new file to the folder's item list in cache
  const qc = getQueryContext().queryClient;
  const optimisticKeyPredicate = (k: readonly unknown[]) =>
    Array.isArray(k) && k[0] === "items" && k[1] === "byFolder" && k[2] &&
    typeof k[2] === "object" && (k[2] as any).spaceId === spaceId && (k[2] as any).folderId === parentId;

  const optimisticFile = {
    ...item,
    // Ensure fields used by UI exist
    itemType: "file",
    previewUrl: item.previewUrl ?? "",
    sizeByte: item.sizeByte ?? null,
    uploading: true,
  } as any;

  qc.setQueriesData({ predicate: (q) => optimisticKeyPredicate(q.queryKey as any) }, (prev: any) => {
    try {
      const items = prev?.data?.data?.items;
      if (Array.isArray(items)) {
        return {
          ...prev,
          data: {
            ...(prev?.data ?? {}),
            data: {
              ...(prev?.data?.data ?? {}),
              items: [optimisticFile, ...items.filter((it: any) => it?.id !== itemId)],
            },
          },
        };
      }
    } catch {}
    // If shape unknown, fall back to simple container
    return {
      data: { data: { items: [optimisticFile] } },
    } as any;
  });

  // 2) Initiate multipart session
  const { data: init, error: initErr } = await app.v1
    .spaces({ spaceId })
    .items({ itemId })
    .uploads.multipart.initiate.post({
      expectedSize: String(fileSize),
      contentType,
    } as any, {} as any);

  if (initErr || !(init as any)?.session?.key || !(init as any)?.session?.uploadId || !(init as any)?.storage?.stagingKey) {
    throw new Error(`Failed to initiate multipart: ${initErr?.value ?? "unknown"}`);
  }

  const sessionKey = (init as any).session.key as string;

  // 3) Upload parts
  const chunkSize = getChunkSize(fileSize);
  const parts: Array<{ PartNumber: number; ETag: string } > = [];
  const partChecksums: Record<number, string> = {};

  let uploaded = 0;
  const total = fileSize;

  const totalParts = Math.max(1, Math.ceil(fileSize / chunkSize));
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    if (controller.signal.aborted) throw new DOMException("Upload aborted", "AbortError");
    const start = (partNumber - 1) * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    const blob = file.slice(start, end);

    // Compute checksum and sign part
    const checksumB64 = await sha256Base64OfBlob(blob);
    partChecksums[partNumber] = checksumB64;
    const isLast = partNumber === totalParts;

    const { data: signData, error: signErr } = await app.v1
      .spaces({ spaceId })
      .items({ itemId })
      .uploads({ sessionKey })
      .parts.post({
        parts: [
          {
            partNumber,
            size: String(blob.size),
            checksumSHA256Base64: checksumB64,
            isLast,
          },
        ],
        overrideContentType: contentType,
      } as any, {} as any);

    if (signErr) {
      throw new Error(`Failed to sign part ${partNumber}: ${signErr.value ?? "unknown"}`);
    }

    const p = (signData as any)?.parts?.[0];
    if (!p?.url) throw new Error(`No presigned URL for part ${partNumber}`);
    const url: string = p.url;
    const headers: Record<string, string> = (p.headers ?? {}) as Record<string, string>;

    // PUT to S3 with signed headers
    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: blob,
      signal: controller.signal,
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      throw new Error(`Failed to upload part ${partNumber}: ${putRes.status} ${text}`);
    }
    const eTag = normalizeETag(putRes.headers.get("etag") || putRes.headers.get("ETag") || undefined);
    parts.push({ PartNumber: partNumber, ETag: eTag });

    uploaded += blob.size;
    const progress = total ? Math.floor((uploaded / total) * 100) : 0;
    useTransferStore.getState().setUploadProgress(id, Math.min(99, progress)); // keep <100 until complete
  }

  // 4) Complete multipart
  const partsInput = parts
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map((p) => ({
      partNumber: p.PartNumber,
      eTag: p.ETag,
      checksumSHA256Base64: partChecksums[p.PartNumber],
    }));

  const { error: completeErr } = await app.v1
    .spaces({ spaceId })
    .items({ itemId })
    .uploads({ sessionKey })
    .complete.post({
      parts: partsInput,
      clientSha256Hex: null,
    } as any, {} as any);

  if (completeErr) {
    throw new Error(`Failed to complete multipart upload: ${completeErr.value ?? "unknown"}`);
  }

  // Done
  useTransferStore.getState().setUploadStatus(id, "success");

  // Replace optimistic flag with finalized data while refetch happens in background
  qc.setQueriesData({ predicate: (q) => optimisticKeyPredicate(q.queryKey as any) }, (prev: any) => {
    try {
      const items = prev?.data?.data?.items;
      if (Array.isArray(items)) {
        return {
          ...prev,
          data: {
            ...(prev?.data ?? {}),
            data: {
              ...(prev?.data?.data ?? {}),
              items: items.map((it: any) => (it?.id === itemId ? { ...it, uploading: false } : it)),
            },
          },
        };
      }
    } catch {}
    return prev;
  });

  // Invalidate any items-byFolder queries for this space/folder so UI refreshes
  await qc.invalidateQueries({
    // Match keys like ["items", "byFolder", { spaceId, folderId, ... }]
    predicate: (q) => {
      const k = q.queryKey as unknown as any[];
      return (
        Array.isArray(k) &&
        k[0] === "items" &&
        k[1] === "byFolder" &&
        k[2] &&
        typeof k[2] === "object" &&
        (k[2] as any).spaceId === spaceId &&
        (k[2] as any).folderId === parentId
      );
    },
  });
}

// Small helper to kick off uploads directly from files (used by UI convenience)
export async function enqueueAndStart(files: File[], spaceId: string, folderId: string) {
  const store = useTransferStore.getState();
  const ids = store.enqueueUploads(files, spaceId, folderId);
  // Optionally open UI if exists
  store.openUpload();
  await startUploadsForIds(spaceId, folderId, ids);
}
