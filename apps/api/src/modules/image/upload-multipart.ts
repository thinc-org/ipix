import { Elysia, t } from "elysia";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  Part,
  AbortMultipartUploadCommand,
  UploadPartCopyCommand, // added
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, expiresIn, s3Region, s3Bucket } from "@repo/s3";
import { betterAuthMiddleware } from "../auth/route.js";
import { createDb } from "../../drizzle/client.js";
import { storageSchema } from "@repo/rdb/schema";
import { previewQueue } from "@repo/s3/worker-preview";
import {
  fileBlobLocationInsertSchema,
  item,
} from "../../../../../packages/rdb/src/schemas/storage.js";
import { eq, inArray, sql, and, isNull } from "drizzle-orm";
import { loadAccessContext } from "../../utils/queryHelper.js";
import { uploadSession } from "../../../../../packages/rdb/src/schemas/storage.js";
import { errorFormatter } from "../../utils/resFormatter.js";
import { hasAllowedMime } from "../../utils/fileTypeHelper.js";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const S3_MIN_PART = 5 * 1024 * 1024; // 5 MiB
const S3_MAX_PART = 5 * 1024 * 1024 * 1024; // 5 GiB
const S3_MAX_PARTS = 10_000n;
const S3_MAX_PARTS_NUMBER = Number(S3_MAX_PARTS); // 10_000 as number
const S3_MAX_OBJECT_SIZE = 5n * 1024n * 1024n * 1024n * 1024n; // 5 TB
const S3_MAX_OBJECT_SIZE_NUMBER = Number(S3_MAX_OBJECT_SIZE);
const PART_PRESIGN_EXPIRES_DEFAULT = expiresIn; // seconds
const PART_PRESIGN_EXPIRES_MIN = 60;
const PART_PRESIGN_EXPIRES_MAX = 3600;
const PROVIDER_AWS_S3 = "aws_s3";

const db = createDb();
// Optional helpers for schema handles
const fileAsset = (storageSchema as any).fileAsset;
const fileBlobLocation = (storageSchema as any).fileBlobLocation;

// Normalize bucket casing once and use everywhere
const BUCKET = s3Bucket.toLowerCase();

async function computeSha256HexFromS3(
  bucket: string,
  key: string
): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) {
    throw new Error(`S3 object ${bucket}/${key} has no Body.`);
  }

  const hash = new Bun.CryptoHasher("sha256");
  const body: any = res.Body as any;

  if (typeof body.transformToByteArray === "function") {
    const bytes: Uint8Array = await body.transformToByteArray();
    hash.update(bytes);
  } else if (typeof body.on === "function") {
    await new Promise<void>((resolve, reject) => {
      body
        .on("data", (chunk: Buffer | Uint8Array) => hash.update(chunk))
        .on("error", reject)
        .on("end", () => resolve());
    });
  } else if (typeof Blob !== "undefined" && body instanceof Blob) {
    const ab = await body.arrayBuffer();
    hash.update(new Uint8Array(ab));
  } else if (
    typeof ReadableStream !== "undefined" &&
    body instanceof ReadableStream
  ) {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) hash.update(value);
      }
    } finally {
      reader.releaseLock?.();
    }
  } else {
    throw new Error("Unsupported S3 Body type.");
  }
  return hash.digest("hex");
}

const generateKey = () => Bun.randomUUIDv7(); // Usable as ElysiaJS validator accept v7

function recommendPartSize(total: bigint): number {
  const MIN = BigInt(S3_MIN_PART);
  const MAX = BigInt(S3_MAX_PART);
  const parts = (total + S3_MAX_PARTS - 1n) / S3_MAX_PARTS;
  const miB = 1024n * 1024n;
  const rounded = ((parts + miB - 1n) / miB) * miB;
  const clamped = rounded < MIN ? MIN : rounded > MAX ? MAX : rounded;
  return Number(clamped);
}

const toStagingKey = (
  spaceId: string,
  itemId: string,
  uploadSessionObjKey: string
) => {
  return `staging/${spaceId}/${itemId}/${uploadSessionObjKey}`;
};

const normalizeETag = (s: string) => s.replaceAll('"', "").replaceAll("\\", "");

const isValidBase64 = (s: string) =>
  /^[A-Za-z0-9+/]+={0,2}$/.test(s) && Buffer.from(s, "base64").length === 32;

// Multipart copy helper for large objects -> canonical
async function multipartCopyLargeObject({
  bucket,
  stagingKey,
  canonicalKey,
  size,
  sseKms,
  checksumMode,
  contentType,
}: {
  bucket: string;
  stagingKey: string;
  canonicalKey: string;
  size: number;
  sseKms?: string | null;
  checksumMode?: string | null;
  contentType?: string | null;
}) {
  const partSize = 64 * 1024 * 1024; // 64 MiB
  const partCount = Math.ceil(size / partSize);
  const { UploadId } = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: canonicalKey,
      ...(contentType ? { ContentType: contentType } : {}),
      ...(sseKms
        ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: sseKms }
        : {}),
      ...(checksumMode === "s3_sha256" ? { ChecksumAlgorithm: "SHA256" } : {}),
    })
  );
  try {
    const parts: { PartNumber: number; ETag: string }[] = [];
    for (let i = 0; i < partCount; i++) {
      const start = i * partSize;
      const end = Math.min(size - 1, start + partSize - 1);
      const copySource = `${bucket}/${encodeURIComponent(stagingKey)}`;
      const r = await s3.send(
        new UploadPartCopyCommand({
          Bucket: bucket,
          Key: canonicalKey,
          PartNumber: i + 1,
          UploadId,
          CopySource: copySource,
          CopySourceRange: `bytes=${start}-${end}`,
        })
      );
      parts.push({ PartNumber: i + 1, ETag: r.CopyPartResult!.ETag! });
    }
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: canonicalKey,
        UploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (e) {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: canonicalKey,
        UploadId,
      })
    );
    throw e;
  }
}

export const uploadRouter = new Elysia({ prefix: "/v1" })
  .use(betterAuthMiddleware)
  /* multipart - initiate upload */
  .post(
    "/spaces/:spaceId/items/:itemId/uploads/multipart/initiate",
    async ({ params, body, set, user, request }) => {
      const { itemId, spaceId } = params;

      // Headers (Idempotency-Key support)
      const idempotencyKey =
        (request.headers.get("Idempotency-Key") ??
          request.headers.get("idempotency-key")) ||
        undefined;

      // Only allow S3 checksum currently
      const checksumMode = "s3_sha256";

      // Validate expectedSize (decimal string)
      if (!body.expectedSize || !/^\d+$/.test(body.expectedSize)) {
        const errMessage = errorFormatter(400, "INVALID_TYPE", {
          field: "expectedSize",
          expected: "decimal string of bytes",
          actualType: "unknown",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      const expectedSizeBigInt = BigInt(body.expectedSize);
      // S3 object max ~5 TB
      if (expectedSizeBigInt < 0n || expectedSizeBigInt > S3_MAX_OBJECT_SIZE) {
        const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
          field: "expectedSize",
          min: 0,
          max: S3_MAX_OBJECT_SIZE_NUMBER,
          actual: expectedSizeBigInt,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const contentTypeNormalized = body.contentType.toLowerCase();

      if (!hasAllowedMime(contentTypeNormalized)) {
        set.status = 400;
        return {
          success: false,
          data: null,
          error: { code: "UNK", message: "Only images file are allowed" },
        };
      }

      // Load and validate item
      const foundItem = await db
        .select({
          id: item.id,
          trashedAt: item.trashedAt,
          itemType: item.itemType,
          fileState: item.fileState,
          spaceId: item.spaceId,
        })
        .from(item)
        .where(eq(item.id, itemId))
        .limit(1);

      if (foundItem.length === 0) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "item",
          queryKey: "id",
          queryValue: itemId,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const it = foundItem[0];

      // DB + authorization
      const ctx = await loadAccessContext(db, user?.id ?? null, it.spaceId);
      // Prefer a "canWrite" flag if available; fallback to isOwner
      if (!ctx.isOwner) {
        const errMessage = errorFormatter(403, "ERR_FORBIDDEN_WRITE", {});
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      if (String(it.spaceId) !== String(spaceId)) {
        const errMessage = errorFormatter(409, "POLICY_MISMATCH", {
          fieldA: "request param space id",
          fieldB: "item space id",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      if (it.trashedAt) {
        const errMessage = errorFormatter(422, "INVALID_STATE", {
          field: "item",
          expected: "not trashed",
          actualType: "trashed",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      if (typeof it.itemType !== "undefined" && it.itemType !== "file") {
        const errMessage = errorFormatter(422, "INVALID_TYPE", {
          field: "Item",
          expected: "file",
          actualType: it.itemType,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Ready -> 409 (do not overwrite)
      if (typeof it.fileState !== "undefined" && it.fileState === "ready") {
        const errMessage = errorFormatter(409, "INVALID_STATE", {
          field: "session",
          expected: "!ready",
          actualType: it.fileState ?? "unknown",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Enforce single active session per item
      const ACTIVE_STATUSES = ["initiated", "in_progress"] as const;
      let existingByIdem = null;
      if (idempotencyKey) {
        const rows = await db
          .select()
          .from(uploadSession)
          .where(
            and(
              eq(uploadSession.itemId, itemId),
              eq(uploadSession.idempotencyKey, idempotencyKey),
              inArray(uploadSession.status, ACTIVE_STATUSES)
            )
          )
          .limit(1);
        existingByIdem = rows[0] ?? null;
      }
      if (existingByIdem) {
        // Idempotent retry: return the existing session as if newly created
        const requiresPartChecksum = checksumMode === "s3_sha256";

        // Compute recommended part size from the existing expectedSize if available
        const sizeForCalc =
          typeof existingByIdem.expectedSize === "bigint"
            ? existingByIdem.expectedSize
            : BigInt(String(existingByIdem.expectedSize ?? body.expectedSize));
        const recommendedPartSize = recommendPartSize(sizeForCalc);

        const sKey = toStagingKey(
          existingByIdem.spaceId,
          existingByIdem.itemId,
          existingByIdem.key
        );

        set.status = 201;
        return {
          success: true,
          session: {
            key: existingByIdem.key,
            itemId,
            uploadId: existingByIdem.uploadId,
            status: existingByIdem.status,
            expectedSize: String(sizeForCalc),
            contentType: existingByIdem.contentType ?? contentTypeNormalized,
            createdAt: new Date(existingByIdem.createdAt as any).toISOString(),
          },
          storage: {
            provider: PROVIDER_AWS_S3,
            region: s3Region,
            bucket: BUCKET,
            stagingKey: sKey,
          },
          constraints: {
            recommendedPartSize,
            minPartSize: S3_MIN_PART,
            maxNumParts: S3_MAX_PARTS_NUMBER,
            requiresPartChecksum,
            presignedPartExpirationSec: PART_PRESIGN_EXPIRES_DEFAULT,
          },
        };
      }

      const existingAny = await db
        .select()
        .from(uploadSession)
        .where(
          and(
            eq(uploadSession.itemId, itemId),
            inArray(uploadSession.status, ACTIVE_STATUSES)
          )
        )
        .limit(1);

      if (existingAny.length > 0) {
        const existing = existingAny[0];
        const errMessage = errorFormatter(409, "POLICY_DUPLICATE", {
          field: "active session",
        });
        set.status = errMessage.status;
        return {
          success: false,
          data: {
            session: {
              key: existing.key,
              status: existing.status,
              createdAt: new Date(existing.createdAt as any).toISOString(),
            },
          },
          error: errMessage,
        };
      }

      // Create new session and staging key
      const sessionKey = generateKey();
      const bucket = BUCKET;
      const stagingKey = toStagingKey(it.spaceId, it.id, sessionKey);

      // S3 key length ≤ 1024 bytes
      if (Buffer.byteLength(stagingKey, "utf8") > 1024) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "UNK",
            message: "Computed object key exceeds maximum length",
          },
        };
      }

      // Create S3 multipart upload
      const createParams: any = {
        Bucket: bucket,
        Key: stagingKey,
        ContentType: contentTypeNormalized,
        StorageClass: body.storageClass,
      };
      if (checksumMode === "s3_sha256") {
        createParams.ChecksumAlgorithm = "SHA256";
      }
      if (body.kmsKeyId) {
        createParams.ServerSideEncryption = "aws:kms";
        createParams.SSEKMSKeyId = body.kmsKeyId;
      }

      const r = await s3.send(new CreateMultipartUploadCommand(createParams));
      if (!r.UploadId) {
        const errMessage = errorFormatter(500, "S3_INITIATION_FAILED", {
          details: "Failed to initiate multipart upload",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Insert upload_session (status='initiated')
      const now = new Date();
      await db.insert(uploadSession).values({
        key: sessionKey,
        itemId,
        spaceId: it.spaceId,
        uploadId: r.UploadId,
        status: "initiated",
        expectedSize: expectedSizeBigInt,
        contentType: contentTypeNormalized,
        checksumMode: checksumMode ?? "none",
        kmsKeyId: body.kmsKeyId ?? null,
        idempotencyKey: idempotencyKey ?? null,
      });

      let recommendedPartSize = recommendPartSize(expectedSizeBigInt);
      if (typeof body.partSizeHint === "number" && body.partSizeHint > 0) {
        const hint = Math.min(
          Math.max(body.partSizeHint, S3_MIN_PART),
          S3_MAX_PART
        );
        const partsCount = Number(
          (expectedSizeBigInt + BigInt(hint) - 1n) / BigInt(hint)
        );
        if (partsCount <= S3_MAX_PARTS_NUMBER) {
          recommendedPartSize = hint;
        }
      }

      const requiresPartChecksum = checksumMode === "s3_sha256";

      set.status = 201;
      return {
        success: true,
        session: {
          key: sessionKey,
          itemId,
          uploadId: r.UploadId,
          status: "initiated",
          expectedSize: String(expectedSizeBigInt),
          contentType: contentTypeNormalized,
          createdAt: now.toISOString(),
        },
        storage: {
          provider: PROVIDER_AWS_S3,
          region: s3Region,
          bucket,
          stagingKey,
        },
        constraints: {
          recommendedPartSize,
          minPartSize: S3_MIN_PART,
          maxNumParts: S3_MAX_PARTS_NUMBER,
          requiresPartChecksum,
          presignedPartExpirationSec: PART_PRESIGN_EXPIRES_DEFAULT,
        },
      };
    },
    {
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        expectedSize: t.String(), // decimal string
        contentType: t.String(),
        storageClass: t.Optional(
          fileBlobLocationInsertSchema.properties.storageClass
        ),
        /*         checksumMode: t.Optional(
          uploadSessionInsertSchema.properties.checksumMode
        ), */
        kmsKeyId: t.Optional(t.String()),
        partSizeHint: t.Optional(t.Number()),
      }),
      auth: { allowPublic: false },
    }
  )

  /* multipart - presign each part */
  .post(
    "/spaces/:spaceId/items/:itemId/uploads/:sessionKey/parts",
    async ({ params, body, query, set, user, request }) => {
      const { sessionKey } = params as { sessionKey: string };

      // Idempotency key (for correlation/logging only)
      const _idempotencyKey =
        request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key") ??
        undefined;

      // Clamp expiration using centralized constants
      const requestedExpires =
        typeof query.expiresSec === "number"
          ? Math.floor(query.expiresSec)
          : undefined;
      const expiresSec =
        requestedExpires === undefined
          ? PART_PRESIGN_EXPIRES_DEFAULT
          : Math.max(
              PART_PRESIGN_EXPIRES_MIN,
              Math.min(PART_PRESIGN_EXPIRES_MAX, requestedExpires)
            );

      // Validate body
      type PartReq = {
        partNumber: number;
        size: string;
        checksumSHA256Base64?: string;
        isLast?: boolean;
      };
      const parts = body.parts as PartReq[] | undefined;
      const overrideContentType = body.overrideContentType as
        | string
        | undefined;

      if (overrideContentType && !hasAllowedMime(overrideContentType)) {
        set.status = 400;
        return {
          success: false,
          data: null,
          error: { code: "UNK", message: "Only images file are allowed" },
        };
      }

      if (
        !Array.isArray(parts) ||
        parts.length < 1 ||
        parts.length > S3_MAX_PARTS_NUMBER
      ) {
        const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
          field: "partNumber",
          min: 0,
          max: S3_MAX_PARTS_NUMBER,
          actual: parts?.length || "unknown",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Load session
      const sessionRows = await db
        .select()
        .from(uploadSession)
        .where(eq(uploadSession.key, sessionKey))
        .limit(1);

      if (sessionRows.length === 0) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "session",
          queryKey: "key",
          queryValue: sessionKey,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const sess = sessionRows[0];

      // Validate session status
      const terminal = ["completed", "aborted", "failed"];
      if (
        terminal.includes(String(sess.status)) ||
        (sess.status !== "initiated" && sess.status !== "in_progress")
      ) {
        const errMessage = errorFormatter(409, "INVALID_STATE", {
          field: "session",
          expected: "initiated, in_progress",
          actualType: sess.status,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Load associated item
      const itemRows = await db
        .select({
          id: item.id,
          itemType: item.itemType,
          trashedAt: item.trashedAt,
          spaceId: item.spaceId,
        })
        .from(item)
        .where(eq(item.id, String(sess.itemId)))
        .limit(1);

      if (itemRows.length === 0) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "item",
          queryKey: "id",
          queryValue: sess.itemId,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const it = itemRows[0];

      if (it.itemType !== "file") {
        const errMessage = errorFormatter(422, "INVALID_TYPE", {
          field: "Item",
          expected: "file",
          actualType: it.itemType,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      if (it.trashedAt) {
        const errMessage = errorFormatter(422, "IS_TRASHED", { field: "Item" });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const ctx = await loadAccessContext(
        db,
        user?.id ?? null,
        String(it.spaceId)
      );
      if (!ctx.isOwner) {
        const errMessage = errorFormatter(403, "ERR_FORBIDDEN_WRITE", {});
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Determine effective Content-Type
      const sessionContentType = String(
        sess.contentType ?? DEFAULT_CONTENT_TYPE
      ).toLowerCase();
      const contentType = (
        overrideContentType ?? sessionContentType
      ).toLowerCase();

      if (
        overrideContentType &&
        sessionContentType &&
        contentType !== sessionContentType
      ) {
        const errMessage = errorFormatter(422, "POLICY_MISMATCH", {
          fieldA: "overrideContentType",
          fieldB: "sessionContentType",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Determine checksum requirement
      const requiresChecksum =
        String(sess.checksumMode ?? "").toLowerCase() === "s3_sha256";

      // Validate parts
      const seen = new Set<number>();

      for (const p of parts) {
        if (
          !p ||
          typeof p.partNumber !== "number" ||
          !Number.isInteger(p.partNumber) ||
          p.partNumber < 1 ||
          p.partNumber > S3_MAX_PARTS_NUMBER
        ) {
          const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
            field: "partNumber",
            min: 0,
            max: S3_MAX_PARTS_NUMBER,
            actual: p.partNumber,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        if (seen.has(p.partNumber)) {
          const errMessage = errorFormatter(400, "POLICY_DUPLICATE", {
            field: "partNumber",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        seen.add(p.partNumber);

        if (typeof p.size !== "string" || !/^\d+$/.test(p.size)) {
          const errMessage = errorFormatter(400, "INVALID_TYPE", {
            field: "size",
            expected: "string of bytes",
            actualType: "unknown",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }

        const sizeBig = BigInt(p.size);
        if (sizeBig <= 0n) {
          const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
            field: "size",
            min: 0,
            max: S3_MAX_PART,
            actual: sizeBig,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        if (sizeBig > BigInt(S3_MAX_PART)) {
          const errMessage = errorFormatter(422, "OUT_OF_RANGE", {
            field: "size",
            min: 0,
            max: S3_MAX_PART,
            actual: sizeBig,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        if (sizeBig < BigInt(S3_MIN_PART) && p.isLast !== true) {
          const errMessage = errorFormatter(422, "OUT_OF_RANGE", {
            field: "size of non last part",
            min: S3_MIN_PART,
            max: S3_MAX_PART,
            actual: sizeBig,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }

        if (requiresChecksum) {
          if (
            !p.checksumSHA256Base64 ||
            !isValidBase64(p.checksumSHA256Base64)
          ) {
            const errMessage = errorFormatter(400, "INVALID_TYPE", {
              field: "checksumSHA256Base64",
              expected: "base64 of 32-byte SHA-256",
              actualType: typeof p.checksumSHA256Base64,
            });
            set.status = errMessage.status;
            return { success: false, data: null, error: errMessage };
          }
        }
      }
      const stagingKey = toStagingKey(sess.spaceId, sess.itemId, sess.key);

      // Optionally mark session in_progress and touch updatedAt
      // TODO Beta Ver: Flip after the first successful part callback
      const now = new Date();
      if (sess.status !== "in_progress") {
        try {
          await db
            .update(uploadSession)
            .set({
              status: "in_progress",
              updatedAt: sql`NOW()`,
            })
            .where(eq(uploadSession.key, sessionKey));
          (sess as any).status = "in_progress";
        } catch {
          // ignore schema differences
        }
      }

      // Generate presigned URLs
      const bucket = BUCKET;
      const partResponses = await Promise.all(
        parts.map(async (p) => {
          const sizeNum = Number(BigInt(p.size)); // safe: <= 5 GiB
          const cmd = new UploadPartCommand({
            Bucket: bucket,
            Key: stagingKey!,
            UploadId: String(sess.uploadId),
            PartNumber: p.partNumber,
            ...(p.checksumSHA256Base64
              ? { ChecksumSHA256: p.checksumSHA256Base64 }
              : {}),
          });

          const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSec });

          const headers: Record<string, string> = {};
          if (p.checksumSHA256Base64) {
            headers["x-amz-checksum-sha256"] = p.checksumSHA256Base64;
          }

          const expiresAt = new Date(
            Date.now() + expiresSec * 1000
          ).toISOString();
          return {
            partNumber: p.partNumber,
            url,
            headers,
            expiresAt,
          };
        })
      );

      set.status = 200;
      return {
        success: true,
        session: {
          key: sess.key,
          itemId: String(sess.itemId),
          status: "in_progress",
          expectedSize: String(sess.expectedSize),
          contentType,
          updatedAt: now.toISOString(),
        },
        storage: {
          provider: PROVIDER_AWS_S3,
          region: s3Region,
          bucket,
          stagingKey,
        },
        parts: partResponses,
        constraints: {
          partSizeMinBytes: String(S3_MIN_PART),
          partSizeMaxBytes: String(S3_MAX_PART),
          maxParts: S3_MAX_PARTS_NUMBER,
          expiresSec,
        },
      };
    },
    {
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
        sessionKey: t.String({ format: "uuid" }),
      }),
      query: t.Object({ expiresSec: t.Optional(t.Number()) }),
      body: t.Object({
        parts: t.Array(
          t.Object({
            partNumber: t.Number(),
            size: t.String(),
            checksumSHA256Base64: t.Optional(t.String()),
            isLast: t.Optional(t.Boolean()),
          }),
          { minItems: 1, maxItems: S3_MAX_PARTS_NUMBER }
        ),
        overrideContentType: t.Optional(t.String()),
      }),
      auth: { allowPublic: false },
    }
  )

  /* multipart - list already uploaded parts */
  .get(
    "/spaces/:spaceId/items/:itemId/uploads/:sessionKey",
    async ({ params, set, user }) => {
      const { sessionKey } = params;
      const [session] = await db
        .select()
        .from(uploadSession)
        .where(eq(uploadSession.key, sessionKey));
      if (!session) {
        set.status = 400;
        const errMessage = errorFormatter(400, "NOT_FOUND", {
          obj: "session",
          queryKey: "key",
          queryValue: sessionKey,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const ctx = await loadAccessContext(
        db,
        user?.id ?? null,
        session.spaceId
      );

      if (!ctx.isOwner) {
        const errMessage = errorFormatter(403, "ERR_FORBIDDEN_WRITE", {});
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const stagingKey = toStagingKey(
        session.spaceId,
        session.itemId,
        session.key
      );

      const parts: Part[] = [];
      // This part work correctly, and, yes, it's a string. It will throw an error when given a number.
      const listPage = async (marker?: string): Promise<void> => {
        const r = await s3.send(
          new ListPartsCommand({
            Bucket: BUCKET,
            Key: stagingKey,
            UploadId: session.uploadId,
            PartNumberMarker: marker,
          })
        );
        parts.push(...(r.Parts ?? []));
        if (r.IsTruncated && r.NextPartNumberMarker !== undefined)
          await listPage(r.NextPartNumberMarker);
      };
      await listPage();
      return { success: true, data: { parts: parts } };
    },
    {
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
        sessionKey: t.String({ format: "uuid" }),
      }),
      auth: { allowPublic: false },
    }
  )
  .post(
    "/spaces/:spaceId/items/:itemId/uploads/:sessionKey/abort",
    async ({ params, set, user }) => {
      const { sessionKey } = params;
      const [sess] = await db
        .select()
        .from(uploadSession)
        .where(eq(uploadSession.key, sessionKey))
        .limit(1);
      if (!sess) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "session",
          queryKey: "key",
          queryValue: sessionKey,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      const ctx = await loadAccessContext(
        db,
        user?.id ?? null,
        String(sess.spaceId)
      );
      if (!ctx.isOwner) {
        const errMessage = errorFormatter(403, "ERR_FORBIDDEN_WRITE", {});
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const stagingKey = toStagingKey(sess.spaceId, sess.itemId, sess.key);
      try {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: BUCKET,
            Key: stagingKey,
            UploadId: String(sess.uploadId),
          })
        );
      } catch {
        /* ignore */
      }
      await db
        .update(uploadSession)
        .set({ status: "aborted", updatedAt: sql`NOW()` })
        .where(eq(uploadSession.key, sessionKey));
      return { success: true };
    },
    {
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
        sessionKey: t.String({ format: "uuid" }),
      }),
      auth: { allowPublic: false },
    }
  )

  /* multipart - complete upload */
  .post(
    "/spaces/:spaceId/items/:itemId/uploads/:sessionKey/complete",
    async ({ params, body, set, user, request }) => {
      const { sessionKey } = params as { sessionKey: string };

      // Idempotency-Key (optional)
      const idempotencyKey =
        request.headers.get("Idempotency-Key") ??
        request.headers.get("idempotency-key") ??
        undefined;

      // Validate body
      const partsInput = body.parts as {
        partNumber: number;
        eTag: string;
        checksumSHA256Base64?: string;
      }[];
      const clientSha256Hex = body.clientSha256Hex;

      if (
        !Array.isArray(partsInput) ||
        partsInput.length < 1 ||
        partsInput.length > S3_MAX_PARTS_NUMBER
      ) {
        const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
          field: "partsInput",
          min: 0,
          max: S3_MAX_PARTS_NUMBER,
          actual: partsInput?.length ?? "unknown",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Load session (and implicitly "lock" by re-check-update later)
      const sessRows = await db
        .select()
        .from(uploadSession)
        .where(eq(uploadSession.key, sessionKey))
        .limit(1);
      if (sessRows.length === 0) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "session",
          queryKey: "key",
          queryValue: sessionKey,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      const sess = sessRows[0];

      const requiresChecksum =
        String(sess.checksumMode ?? "").toLowerCase() === "s3_sha256";
      for (const p of partsInput) {
        if (requiresChecksum && !isValidBase64(p.checksumSHA256Base64 ?? "")) {
          const errMessage = errorFormatter(400, "INVALID_TYPE", {
            field: `checksumSHA256Base64 for part ${p.partNumber}`,
            expected: "base64 of 32-byte SHA-256",
            actualType: typeof p.checksumSHA256Base64,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
      }

      const finalChecksumB64 =
        clientSha256Hex && /^[a-f0-9]{64}$/i.test(clientSha256Hex)
          ? Buffer.from(clientSha256Hex, "hex").toString("base64")
          : undefined;

      // Load item and basic validation
      const itemRows = await db
        .select()
        .from(item)
        .where(eq(item.id, String(sess.itemId)))
        .limit(1);

      if (itemRows.length === 0) {
        const errMessage = errorFormatter(404, "NOT_FOUND", {
          obj: "item",
          queryKey: "session key",
          queryValue: sessionKey,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      const it = itemRows[0];

      // AuthZ
      const ctx = await loadAccessContext(
        db,
        user?.id ?? null,
        String(it.spaceId)
      );
      if (!ctx.isOwner) {
        const errMessage = errorFormatter(403, "ERR_FORBIDDEN_WRITE", {});
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      if (it.itemType !== "file") {
        const errMessage = errorFormatter(500, "UNEXPECTED_TYPE", {
          field: "item",
          expected: "file",
          actualType: it.itemType,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }
      if (it.trashedAt) {
        const errMessage = errorFormatter(422, "INVALID_STATE", {
          field: "item",
          expected: "not trashed",
          actualType: "trashed",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Idempotent returns for already-ready or completed session
      if (it.fileState === "ready" || String(sess.status) === "completed") {
        // Try to load primary canon blob location for response
        // ...construct minimal response from existing item state...
        set.status = 200;
        return {
          success: true,
          item: {
            id: String(it.id),
            fileState: "ready",
            mimeType: String(
              it.mimeType ?? sess.contentType ?? DEFAULT_CONTENT_TYPE
            ),
            sizeByte: String(it.sizeByte ?? sess.expectedSize ?? "0"),
            assetId: "",
            updatedAt: new Date(it.updatedAt ?? Date.now()).toISOString(),
          },
          // asset/blobLocation best-effort omitted if not easily resolvable here
          asset: undefined,
          blobLocation: undefined,
          uploadSession: {
            key: String(sess.key),
            status: "completed",
            completedAt: new Date(sess.updatedAt ?? Date.now()).toISOString(),
          },
        };
      }

      // Allowed statuses to complete
      if (sess.status !== "initiated" && sess.status !== "in_progress") {
        const errMessage = errorFormatter(409, "INVALID_STATE", {
          field: "session",
          expected: "initiated, in_progress",
          actualType: sess.status,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Validate expected size
      let expectedSizeBig: bigint;
      try {
        expectedSizeBig = BigInt(String(sess.expectedSize ?? "0"));
      } catch {
        const errMessage = errorFormatter(500, "UNEXPECTED_TYPE", {
          field: "expectedSize",
          expected: "BigInt",
          actualType: typeof sess.expectedSize,
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Parts validation: sanitize eTags, ensure contiguous
      const seen = new Set<number>();
      const eTagOk = (s: string) => typeof s === "string" && s.length > 0;
      for (const p of partsInput) {
        if (
          !p ||
          !Number.isInteger(p.partNumber) ||
          p.partNumber < 1 ||
          p.partNumber > S3_MAX_PARTS_NUMBER
        ) {
          const errMessage = errorFormatter(400, "OUT_OF_RANGE", {
            field: "partNumber",
            min: 0,
            max: S3_MAX_PARTS_NUMBER,
            actual: p.partNumber,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        if (seen.has(p.partNumber)) {
          const errMessage = errorFormatter(400, "POLICY_DUPLICATE", {
            field: "partNumber",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        seen.add(p.partNumber);
        if (!eTagOk(p.eTag)) {
          const errMessage = errorFormatter(400, "INVALID_TYPE", {
            field: `eTag at ${p.partNumber}`,
            expected: "non-empty string",
            actualType: typeof p.eTag,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        if (p.checksumSHA256Base64) {
          // basic b64 format check for 32-byte sha256
          const b64 = p.checksumSHA256Base64;
          const ok = isValidBase64(b64);
          if (!ok) {
            const errMessage = errorFormatter(400, "INVALID_VALUE", {
              field: "part checksum",
              valueName: `part ${p.partNumber}`,
            });
            set.status = errMessage.status;
            return { success: false, data: null, error: errMessage };
          }
        }
      }
      const parts = [...partsInput].sort((a, b) => a.partNumber - b.partNumber);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].partNumber !== i + 1) {
          const errMessage = errorFormatter(400, "INVALID_CONTINUATION", {
            field: "part number",
            startNum: 1,
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
      }

      const stagingKey = toStagingKey(sess.spaceId, sess.itemId, sess.key);
      const bucket = BUCKET;

      // Complete multipart upload on S3
      let completeOk = false;
      try {
        console.log(sess);
        console.log(parts);
        const cmu = await s3.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: stagingKey,
            UploadId: String(sess.uploadId),
            MultipartUpload: {
              Parts: parts.map((p) => ({
                PartNumber: p.partNumber,
                ETag: p.eTag,
                ChecksumSHA256: p.checksumSHA256Base64,
              })),
            },
            ...(finalChecksumB64 ? { ChecksumSHA256: finalChecksumB64 } : {}),
          })
        );
        // Treat 200 as success; if S3 already completed previously, we'll continue
        completeOk = true;
      } catch (err: any) {
        console.log(err);
        // If S3 indicates AlreadyCompleted or similar, continue as success
        const msg = String(err?.name ?? err?.Code ?? "");
        if (/Already|completed/i.test(msg)) {
          completeOk = true;
        } else {
          const errMessage = errorFormatter(502, "S3_COMPLETE_FAILED", {
            details: msg ?? "S3 error",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
      }

      // HEAD the staging object for size and checksum
      let headStaging;
      try {
        headStaging = await s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: stagingKey })
        );
      } catch (err: any) {
        const errMessage = errorFormatter(502, "S3_HEAD_FAILED", {
          details: err.message ?? "staging object not found after completion",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      const actualSizeNum = Number(headStaging.ContentLength ?? 0);
      const actualSizeBig = BigInt(String(actualSizeNum));
      if (actualSizeBig !== expectedSizeBig) {
        const errMessage = errorFormatter(422, "POLICY_MISMATCH", {
          fieldA: "session file size",
          fieldB: "s3 file size",
        });
        set.status = errMessage.status;
        return { success: false, data: null, error: errMessage };
      }

      // Determine final sha256Hex
      const s3Hex = headStaging.ChecksumSHA256
        ? Buffer.from(headStaging.ChecksumSHA256, "base64").toString("hex")
        : null;

      const clientHex =
        clientSha256Hex && /^[a-f0-9]{64}$/i.test(clientSha256Hex)
          ? clientSha256Hex.toLowerCase()
          : null;

      let finalHex: string;

      // Prefer S3 checksum when available
      if (s3Hex) {
        if (clientHex && clientHex !== s3Hex) {
          const errMessage = errorFormatter(422, "POLICY_MISMATCH", {
            fieldA: "client checksum",
            fieldB: "s3 checksum",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        finalHex = s3Hex;
      } else {
        const computedHex = await computeSha256HexFromS3(bucket, stagingKey);
        if (clientHex && clientHex !== computedHex) {
          const errMessage = errorFormatter(422, "POLICY_MISMATCH", {
            fieldA: "client checksum",
            fieldB: "computed checksum",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
        finalHex = computedHex;
      }

      const sha256Hex = finalHex;
      const sha24 = sha256Hex.slice(0, 24);
      const canonicalKey = `assets/${sha24}/${sha256Hex}`;

      // Dedupe: does canonical exist?
      let canonExists = false;
      let canonVersionId: string | undefined;
      let canonEtag: string | undefined;
      let canonStorageClass: string | undefined;
      try {
        const headCanon = await s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: canonicalKey })
        );
        canonExists = true;
        canonVersionId = headCanon.VersionId;
        canonEtag = headCanon.ETag;
      } catch {
        // Not found -> copy
        try {
          // Use multipart copy when object is larger than single-part copy limit (5 GiB)
          if (actualSizeNum > S3_MAX_PART) {
            await multipartCopyLargeObject({
              bucket,
              stagingKey,
              canonicalKey,
              size: actualSizeNum,
              sseKms: sess.kmsKeyId ?? undefined,
              checksumMode: String(sess.checksumMode ?? "none"),
              contentType: sess.contentType,
            });
            const headCanonAfter = await s3.send(
              new HeadObjectCommand({ Bucket: bucket, Key: canonicalKey })
            );
            canonExists = true;
            canonVersionId = headCanonAfter.VersionId;
            canonEtag = normalizeETag(headCanonAfter.ETag!);
            canonStorageClass = headCanonAfter.StorageClass;
          } else {
            const copy = await s3.send(
              new CopyObjectCommand({
                Bucket: bucket,
                Key: canonicalKey,
                CopySource: `${bucket}/${encodeURIComponent(stagingKey)}`,
                MetadataDirective: "REPLACE",
                ContentType: String(
                  sess.contentType ??
                    headStaging.ContentType ??
                    DEFAULT_CONTENT_TYPE
                ).toLowerCase(),
                ServerSideEncryption: sess.kmsKeyId ? "aws:kms" : undefined,
                SSEKMSKeyId: sess.kmsKeyId ?? undefined,
              })
            );
            const headCanonAfter = await s3.send(
              new HeadObjectCommand({ Bucket: bucket, Key: canonicalKey })
            );
            canonExists = true;
            canonVersionId = headCanonAfter.VersionId;
            canonEtag = normalizeETag(headCanonAfter.ETag!);
            canonStorageClass = headCanonAfter.StorageClass;
          }
        } catch (err: any) {
          const errMessage = errorFormatter(502, "S3_COPY_FAILED", {
            details: err.message ?? "s3 copy failed",
          });
          set.status = errMessage.status;
          return { success: false, data: null, error: errMessage };
        }
      }

      const contentType = String(
        sess.contentType ?? headStaging.ContentType ?? DEFAULT_CONTENT_TYPE
      ).toLowerCase();

      // DB transaction: upsert asset, insert/reuse blob, update item and session
      const now = new Date();
      let assetRow: any;
      let blobRow: any;
      let itemRow: any;

      // Convert hex to raw bytes for upsert-by-bytes, if schema expects bytes
      const shaBytes = Buffer.from(sha256Hex, "hex");

      await db.transaction(async (tx) => {
        // Upsert file_asset by sha256 (raw 32 bytes). Adjust for your schema/dialect.
        if (fileAsset) {
          // Pseudo-upsert for Drizzle; replace with your onConflict syntax if available
          const existing = await tx
            .select({
              id: fileAsset.id,
            })
            .from(fileAsset)
            .where(eq(fileAsset.sha256, shaBytes))
            .limit(1);

          if (existing.length === 0) {
            const inserted = (await tx
              .insert(fileAsset)
              .values({
                sha256: shaBytes,
                sizeByte: actualSizeBig,
                contentType,
              })
              .returning()) as any;
            assetRow = inserted[0];
          } else {
            const updated = await tx
              .update(fileAsset)
              .set({ sizeByte: actualSizeBig, contentType, updatedAt: now })
              .where(eq(fileAsset.id, existing[0].id))
              .returning();
            assetRow = updated[0];
          }
        } else {
          // Fallback mock if schema handle is not wired
          assetRow = {
            id: generateKey(),
            sha256Hex,
            sizeByte: actualSizeBig,
            contentType,
          };
        }

        // Insert or reuse file_blob_location (canon)
        if (fileBlobLocation) {
          // Try reuse
          const existLoc = await tx
            .select({
              id: fileBlobLocation.id,
              isPrimary: fileBlobLocation.isPrimary,
            })
            .from(fileBlobLocation)
            .where(
              and(
                eq(fileBlobLocation.assetId, assetRow.id),
                eq(fileBlobLocation.kind, "canon"),
                eq(fileBlobLocation.bucket, bucket),
                eq(fileBlobLocation.objectKey, canonicalKey)
              )
            )
            .limit(1);

          if (existLoc.length === 0) {
            const insertedLoc = (await tx
              .insert(fileBlobLocation)
              .values({
                assetId: assetRow.id,
                kind: "canon",
                provider: PROVIDER_AWS_S3,
                region: s3Region,
                bucket,
                objectKey: canonicalKey,
                versionId: canonVersionId,
                etag: canonEtag,
                storageClass: canonStorageClass ?? undefined,
                state: "active",
                isPrimary: true,
              })
              .returning()) as any;
            blobRow = insertedLoc[0];
          } else {
            const updatedLoc = await tx
              .update(fileBlobLocation)
              .set({
                versionId: canonVersionId,
                etag: canonEtag,
                updatedAt: now,
                state: "active",
              })
              .where(eq(fileBlobLocation.id, existLoc[0].id))
              .returning();
            blobRow = updatedLoc[0];
          }
        } else {
          blobRow = {
            id: generateKey(),
            provider: PROVIDER_AWS_S3,
            region: s3Region,
            bucket,
            objectKey: canonicalKey,
            versionId: canonVersionId,
            etag: canonEtag,
            isPrimary: true,
            state: "active",
          };
        }

        // Update item to ready
        const updatedItems = await tx
          .update(item)
          .set({
            fileState: "ready",
            mimeType: contentType,
            sizeByte: actualSizeBig,
            assetId: assetRow.id,
            updatedAt: sql`NOW()`,
          })
          .where(eq(item.id, String(it.id)))
          .returning({
            id: item.id,
            fileState: item.fileState,
            mimeType: item.mimeType,
            sizeByte: item.sizeByte,
            assetId: item.assetId,
            updatedAt: item.updatedAt,
          });
        itemRow = updatedItems[0];

        // Mark session completed
        await tx
          .update(uploadSession)
          .set({
            status: "completed",
            completedAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
            idempotencyKey: idempotencyKey,
          })
          .where(eq(uploadSession.key, sessionKey));
      });

      await previewQueue.add("generate", {
        spaceId: it.spaceId,
        itemId: it.id,
        assetId: assetRow.id,
        sha256: shaBytes,
        variants: [
          { variant: "thumb", algoV: 1, ext: "webp", maxEdge: 360 },
          { variant: "web", algoV: 1, ext: "webp", maxEdge: 1080 },
        ],
      });

      // Best-effort cleanup: delete staging object
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: stagingKey })
        );
      } catch {
        // ignore
      }

      set.status = 200;
      return {
        success: true,
        item: {
          id: String(itemRow.id),
          fileState: "ready",
          mimeType: String(itemRow.mimeType),
          sizeByte: String(itemRow.sizeByte),
          assetId: String(itemRow.assetId),
          updatedAt: new Date(itemRow.updatedAt).toISOString(),
        },
        asset: {
          id: String(assetRow.id),
          sha256Hex,
          sha256Hex24: sha24,
          sizeByte: String(actualSizeBig),
          contentType,
        },
        blobLocation: {
          id: String(blobRow.id),
          provider: PROVIDER_AWS_S3,
          region: s3Region,
          bucket,
          objectKey: canonicalKey,
          versionId: canonVersionId,
          etag: canonEtag,
          isPrimary: Boolean(blobRow.isPrimary ?? true),
          state: String(blobRow.state ?? "active"),
        },
        uploadSession: {
          key: sessionKey,
          status: "completed",
          completedAt: new Date().toISOString(),
        },
      };
    },
    {
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
        sessionKey: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        parts: t.Array(
          t.Object({
            partNumber: t.Number(),
            eTag: t.String(),
            checksumSHA256Base64: t.Optional(t.String()),
          }),
          { minItems: 1, maxItems: S3_MAX_PARTS_NUMBER }
        ),
        clientSha256Hex: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      auth: { allowPublic: false },
    }
  );
