import { Elysia, t } from "elysia";
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  Part,
  AbortMultipartUploadCommand,
  UploadPartCopyCommand, // added
} from "@aws-sdk/client-s3";
import { GetFederationTokenCommand } from "@aws-sdk/client-sts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, sts, expiresIn, s3Region, s3Bucket } from "@repo/s3";
import { betterAuthMiddleware } from "../auth/route.js";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import { createDb } from "../../drizzle/client.js";
import { storageSchema } from "@repo/rdb/schema";
import {
  fileBlobLocationInsertSchema,
  item,
  uploadSessionInsertSchema,
} from "../../../../../packages/rdb/src/schemas/storage.js";
import { eq, inArray, sql, and } from "drizzle-orm";
import { loadAccessContext } from "../../utils/queryHelper.js";
import { uploadSession } from "../../../../../packages/rdb/src/schemas/storage.js";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const S3_MIN_PART = 5 * 1024 * 1024; // 5 MiB
const S3_MAX_PART = 5 * 1024 * 1024 * 1024; // 5 GiB
const S3_MAX_PARTS = 10_000n;
const S3_MAX_OBJECT_SIZE = 5n * 1024n * 1024n * 1024n * 1024n; // 5 TB
const S3_MAX_PARTS_NUMBER = Number(S3_MAX_PARTS); // 10_000 as number
const PART_PRESIGN_EXPIRES_DEFAULT = 900; // seconds
const PART_PRESIGN_EXPIRES_MIN = 60;
const PART_PRESIGN_EXPIRES_MAX = 3600;
const PROVIDER_AWS_S3 = "aws_s3";
const BATCH_DOWNLOAD_CONCURRENCY = 6;
const ERR_FORBIDDEN_WRITE = "Forbidden: no write permission in this space";

const db = createDb();
// Optional helpers for schema handles
const fileAsset = (storageSchema as any).fileAsset;
const fileBlobLocation = (storageSchema as any).fileBlobLocation;

// Normalize bucket casing once and use everywhere
const BUCKET = s3Bucket.toLowerCase();

const generateKey = () => Bun.randomUUIDv7();

function recommendPartSize(total: bigint): number {
  const MIN = BigInt(S3_MIN_PART);
  const MAX = BigInt(S3_MAX_PART);
  const parts = (total + S3_MAX_PARTS - 1n) / S3_MAX_PARTS;
  const miB = 1024n * 1024n;
  const rounded = ((parts + miB - 1n) / miB) * miB;
  const clamped = rounded < MIN ? MIN : (rounded > MAX ? MAX : rounded);
  return Number(clamped);
}

// Helper: extract itemId from an object key that is either a UUID or `${uuid}-${name}`
const extractItemIdFromKey = (key: string): string | null => {
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (uuidPattern.test(key)) return key;
  const m = key.match(
    /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})-/
  );
  return m ? m[1] : null;
};

const toStagingKey = (spaceId: string, sessionKey: string) => {
  return `staging/uploads/${spaceId}/${sessionKey}`;
};

const isValidBase64 = (s: string) =>
  /^[A-Za-z0-9+/]+={0,2}$/.test(s) && Buffer.from(s, "base64").length === 32;

// Sanitize header values for AWS S3 metadata
// AWS S3 metadata values must be ASCII and certain characters are forbidden
const sanitizeHeaderValue = (value: string): string => {
  return value
    .replace(/[^\x20-\x7E]/g, "") // Remove non-ASCII characters
    .replace(/[\r\n\t]/g, "") // Remove control characters
    .replace(/[\"\\]/g, "") // Remove quotes and backslashes
    .trim();
};

// currently only allow image
const isAllowedMime = (type?: string) =>
  !!type && /^image\/[a-zA-Z0-9.+-]+$/.test(type);

// currently only allow image
const hasAllowedExtension = (filename?: string) =>
  !!filename && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(filename);
