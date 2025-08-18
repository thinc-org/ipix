import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { s3, s3Bucket, s3Region } from "../index";
import { Client as PgClient } from "pg";
import sharp from "sharp";
import type { Readable } from "stream";
import exifr from "exifr";

type ImageMetadata = sharp.Metadata;

// Job contract
// Inputs:
// - spaceId, itemId, assetId: uuid strings
// - sha24: first 24 hex of sha256 (optional; if omitted, will fetch from DB)
// - contentType: source file mime (e.g., image/jpeg)
// - variants: array of { variant: string, algoV: number, ext?: string, width?: number, height?: number, maxEdge?: number }
//   - If maxEdge is provided, the image is resized to fit within a maxEdge x maxEdge box (fit: inside),
//     preserving aspect ratio. The longest edge becomes maxEdge (unless the image is already smaller),
//     and no upscaling occurs.
// - sourceKey: canonical object key to read from (optional; derive via DB if not provided)
// Outputs:
// - S3 objects written at: spaces/${spaceId}/${itemId}/${sha24}/previews/${variant}@v${algoV}[.ext]
// - file_blob_location rows upserted via DB helper function semantics

type PreviewVariant = {
  variant: string;
  algoV: number;
  ext?: string | null;
  width?: number;
  height?: number;
  // If provided, resize to fit within maxEdge x maxEdge (preserving aspect ratio, no enlargement)
  maxEdge?: number;
};

export type PreviewJob = {
  spaceId: string;
  itemId: string;
  assetId: string;
  sha24?: string;
  contentType?: string;
  sourceKey?: string;
  variants: PreviewVariant[];
};

// Env
const {
  REDIS_URL = "redis://127.0.0.1:6379",
  DATABASE_URL,
  S3_BUCKET,
} = process.env as Record<string, string | undefined>;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for preview worker");
}

// BullMQ workers use blocking Redis commands; ioredis must not retry requests.
// See error: "BullMQ: Your redis options maxRetriesPerRequest must be null."
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});
export const PREVIEW_QUEUE_NAME = "preview.generate";
export const previewQueue = new Queue<PreviewJob>(PREVIEW_QUEUE_NAME, {
  connection: redis,
});

// DB
const pg = new PgClient({ connectionString: DATABASE_URL! });
await pg.connect();

// Helpers
const normalizeExt = (ext?: string | null) =>
  ext && ext.trim() !== "" ? ext.replace(/^\./, "").toLowerCase() : null;

// Image handling helpers
const isImageContentType = (ct?: string | null) =>
  !!ct &&
  /^(image)\/(jpeg|jpg|png|webp|avif|gif|tiff|bmp|nef|x-icon|svg\+xml)$/i.test(
    ct
  );

function detectOutputFormat(
  ext?: string | null,
  fallbackCt?: string | null
): {
  fmt: "jpeg" | "png" | "webp" | "avif";
  mime: string;
} {
  const e = (ext ?? "").toLowerCase();
  if (e === "jpg" || e === "jpeg") return { fmt: "jpeg", mime: "image/jpeg" };
  if (e === "png") return { fmt: "png", mime: "image/png" };
  if (e === "avif") return { fmt: "avif", mime: "image/avif" };
  if (e === "webp") return { fmt: "webp", mime: "image/webp" };
  // If no ext, map from source content-type; default to webp
  const ct = (fallbackCt ?? "").toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg"))
    return { fmt: "jpeg", mime: "image/jpeg" };
  if (ct.includes("png")) return { fmt: "png", mime: "image/png" };
  if (ct.includes("avif")) return { fmt: "avif", mime: "image/avif" };
  return { fmt: "webp", mime: "image/webp" };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

async function getSourceObjectBufferAndCt(
  key: string
): Promise<{ buf: Buffer; contentType: string | undefined }> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: s3Bucket, Key: key })
  );
  const body: any = res.Body;
  let buf: Buffer;
  if (!body) throw new Error("empty S3 body");
  if (typeof (body as any).transformToByteArray === "function") {
    const u8 = await (body as any).transformToByteArray();
    buf = Buffer.from(u8);
  } else if (typeof (body as any).arrayBuffer === "function") {
    const ab = await (body as any).arrayBuffer();
    buf = Buffer.from(ab);
  } else {
    buf = await streamToBuffer(body as Readable);
  }
  return { buf, contentType: res.ContentType };
}

async function generatePreviewBuffer(
  variant: PreviewVariant,
  src: Buffer<ArrayBufferLike>,
  contentType: string | undefined,
  sourceCt?: string | null
): Promise<{ buf: Buffer; mime: string } | null> {
  const inCt = sourceCt ?? contentType ?? null;
  if (!isImageContentType(inCt)) return null;

  const { fmt, mime } = detectOutputFormat(variant.ext, inCt);
  let img = sharp(src, { failOnError: false });
  // Respect requested size if provided
  // 1) If maxEdge is specified (or alias `max`), ensure longest side is maxEdge while preserving aspect ratio.
  const maxEdge = (variant.maxEdge ?? (variant as any).max) as
    | number
    | undefined;
  if (typeof maxEdge === "number" && maxEdge > 0) {
    img = img.resize(maxEdge, maxEdge, {
      fit: "inside",
      withoutEnlargement: true,
    });
  } else if (variant.width || variant.height) {
    // 2) Fall back to width/height bounding box behavior
    img = img.resize(variant.width, variant.height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  // Encode
  switch (fmt) {
    case "jpeg":
      img = img.jpeg({ quality: 82, progressive: true, mozjpeg: true });
      break;
    case "png":
      img = img.png({ compressionLevel: 9 });
      break;
    case "webp":
      img = img.webp({ quality: 80 });
      break;
    case "avif":
      img = img.avif({ quality: 55 });
      break;
  }
  const out = await img.toBuffer();
  return { buf: out, mime };
}

async function ensureSha24(assetId: string): Promise<string> {
  const r = await pg.query<{ sha24: string }>(
    `SELECT substring(encode(sha256, 'hex') for 24) AS sha24 FROM file_asset WHERE id = $1 LIMIT 1`,
    [assetId]
  );
  const row = r.rows[0];
  if (!row || !row.sha24) {
    throw new Error("asset sha24 not found");
  }
  return row.sha24 as string;
}

async function ensureCanonKey(assetId: string): Promise<string> {
  // Primary canon location for the asset
  const r = await pg.query<{ key: string }>(
    `SELECT object_key AS key FROM file_blob_location WHERE asset_id = $1 AND kind = 'canon' AND is_primary = true LIMIT 1`,
    [assetId]
  );
  const row = r.rows[0];
  if (!row || !row.key) throw new Error("primary canon not found");
  return row.key as string;
}

// Call DB helper to upsert preview location and get finalized key
async function upsertPreviewLocation(params: {
  assetId: string;
  itemId: string;
  variant: string;
  algoV: number;
  ext?: string | null;
}): Promise<{ id: string; objectKey: string }> {
  const { assetId, itemId, variant, algoV, ext } = params;
  // The SQL helper upsert_preview_location() exists in migrations. Use it directly for key computation and idempotency.
  const r = await pg.query<{ id: string; object_key: string }>(
    `SELECT id, object_key
				 FROM upsert_preview_location(
					 $1::uuid, $2::uuid,
					 'aws_s3'::blob_provider,
					 $3::text, $4::citext,
					 $5::citext, $6::smallint,
					 NULL::text, $7::text,
					 NULL::blob_storage_class, NULL::text
				 )`,
    [assetId, itemId, s3Region, s3Bucket, variant, algoV, ext ?? null]
  );
  const row = r.rows?.[0];
  if (!row) throw new Error("failed to upsert preview location");
  return { id: row.id, objectKey: row.object_key };
}

async function copyOrPutPreview(
  srcKey: string,
  destKey: string,
  variant: PreviewVariant,
  src: Buffer<ArrayBufferLike>,
  contentType: string | undefined,
  sourceCtHint?: string | null
) {
  if (!srcKey) throw new Error("source key missing");
  // Try to process with sharp; fallback to server-side copy
  try {
    const processed = await generatePreviewBuffer(
      variant,
      src,
      contentType,
      sourceCtHint
    );
    if (processed) {
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: destKey,
          Body: processed.buf,
          ContentType: processed.mime,
          ACL: undefined,
        })
      );
      return;
    }
  } catch (e) {
    console.warn(`sharp processing failed for ${destKey}, fallback to copy`, e);
  }
  await s3.send(
    new CopyObjectCommand({
      Bucket: s3Bucket,
      Key: destKey,
      CopySource: `${s3Bucket}/${encodeURIComponent(srcKey)}`,
      MetadataDirective: "COPY",
    })
  );
}

export const previewWorker = new Worker<PreviewJob>(
  PREVIEW_QUEUE_NAME,
  async (job: Job<PreviewJob>) => {
    const { spaceId, itemId, assetId } = job.data;
    const sha24 = job.data.sha24 ?? (await ensureSha24(assetId));
    const sourceKey = job.data.sourceKey ?? (await ensureCanonKey(assetId));
    let { buf: src, contentType } = await getSourceObjectBufferAndCt(sourceKey);
    const thumbnailImg = await exifr.thumbnail(src);
    console.log(thumbnailImg);
    if (thumbnailImg !== undefined) {
      if (thumbnailImg instanceof Uint8Array) {
        src = Buffer.from(thumbnailImg);
      } else {
        src = thumbnailImg;
      }
    }
    const imgMetadata = await exifr.parse(src, true);
    console.log(imgMetadata);
    let takenAt;
    if (imgMetadata.DateTimeOriginal) {
      takenAt = new Date(imgMetadata.DateTimeOriginal);
    }
    let geographicObj;
    if (imgMetadata.longitude && imgMetadata.latitude) {
      geographicObj = { lon: imgMetadata.longitude, lat: imgMetadata.latitude };
    }
    const imgMetadataInsertObj = {
      exif: imgMetadata ?? null,
      takenAt: takenAt,
      takenLocal: imgMetadata.OffsetTime ?? null,
      takenOffsetMin: takenAt ? takenAt.getTimezoneOffset() : null,
      takenSubsec: Number(imgMetadata.SubSecTimeOriginal),
      cameraMake: imgMetadata.Make ?? null,
      cameraModel: imgMetadata.Model,
      lensMake: null,
      lensModel: null,
      iso: Number(imgMetadata.ISO) ?? null,
      fNumber: imgMetadata.FNumber ?? null,
      exposureTimeNum: Number(imgMetadata.ExposureTime) ?? null,
      exposureTimeDen: null,
      focalLenMm: imgMetadata.FocalLength,
      focalLen35Mm: imgMetadata.FocalLengthIn35mmFormat ?? null,
      exposureBiasEv: imgMetadata.ExposureCompensation ?? null,
      flashFired: null,
      meteringMode: imgMetadata.MeteringMode ?? null,
      exposureProgram: imgMetadata.exposureProgram ?? null,
      orientation: imgMetadata.orientation ?? null,
      rotationDeg: null,
      colorSpace: null,
      bitDepth: Number(imgMetadata.BitDepth) ?? null,
      hasIcc: imgMetadata.icc ? true : false,
      gpsGeom: geographicObj,
      gpsGeog: geographicObj,
      gpsAltM: null,
      gpdDop: null,
      gpsTimestamp: null,
    };
    /*     const updateFileAssetQuery = await pg.query<{
      id: string;
      object_key: string;
    }>(
      `SELECT id, object_key
				 FROM upsert_preview_location(
					 $1::uuid, $2::uuid,
					 'aws_s3'::blob_provider,
					 $3::text, $4::citext,
					 $5::citext, $6::smallint,
					 NULL::text, $7::text,
					 NULL::blob_storage_class, NULL::text
				 )`,
      [assetId, itemId, s3Region, s3Bucket, variant, algoV, ext ?? null]
    );
    const row = updateFileAssetQuery.rows?.[0]; */

    const rawThumbnail = "";
    for (const v of job.data.variants) {
      const ext = normalizeExt(v.ext);

      // Upsert to get final preview key; idempotent if exists
      const { objectKey } = await upsertPreviewLocation({
        assetId,
        itemId,
        variant: v.variant,
        algoV: v.algoV,
        ext: ext ?? undefined,
      });

      // Write the preview
      await copyOrPutPreview(
        sourceKey,
        objectKey,
        { ...v, ext },
        src,
        contentType,
        job.data.contentType
      );
    }

    return { ok: true };
  },
  {
    connection: redis,
    concurrency: 4,
  }
);

previewWorker.on("failed", (job: Job<PreviewJob> | undefined, err: Error) => {
  console.error(`Preview job ${job?.id} failed:`, err);
});

previewWorker.on("completed", (job: Job<PreviewJob>) => {
  console.log(`Preview job ${job.id} completed`);
});

// Optional: small self-runner when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Preview worker started");
}
