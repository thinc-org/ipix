import { Elysia, t } from "elysia";
import {
  GetObjectCommand,
  DeleteObjectCommand,
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
  item,
} from "../../../../../packages/rdb/src/schemas/storage.js";
import { eq, inArray, sql, and } from "drizzle-orm";
import { loadAccessContext } from "../../utils/queryHelper.js";

const S3_MIN_PART = 5 * 1024 * 1024; // 5 MiB
const S3_MAX_PART = 5 * 1024 * 1024 * 1024; // 5 GiB
const S3_MAX_PARTS = 10_000n;
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

export const s3Router = new Elysia({ prefix: "/v1" })
  .use(betterAuthMiddleware)
  //Get single image
  .get(
    "/image/:imageKey",
    async ({ params, set, query, user }) => {
      const { imageKey } = params;
      const { download } = query;

      // AuthN/Z: allow if public or owner
      const itemId = extractItemIdFromKey(imageKey);
      if (!itemId) {
        set.status = 403;
        return { error: "forbidden" };
      }

      const rows = await db
        .select({
          id: item.id,
          createdBy: item.createdBy,
          accessType: item.accessType,
          trashedAt: item.trashedAt,
        })
        .from(item)
        .where(eq(item.id, itemId))
        .limit(1);

      if (rows.length === 0) {
        set.status = 404;
        return { error: "not_found" };
      }

      const rec = rows[0];
      const isOwner = !!user?.id && String(rec.createdBy) === String(user.id);
      const isPublic =
        String((rec as any).accessType ?? "").toLowerCase() === "public";

      if (!isPublic && !isOwner) {
        set.status = 403;
        return { error: "forbidden" };
      }
      if (rec.trashedAt) {
        set.status = 410;
        return { error: "gone" };
      }

      const getObjectCommandInput = {
        Bucket: BUCKET,
        Key: imageKey,
      };

      if (download === "true") {
        const filename = imageKey.split("/").pop() || "download";
        Object.assign(getObjectCommandInput, {
          ResponseContentDisposition: `attachment; filename="${decodeURIComponent(filename)}"`,
        });
      } else {
        Object.assign(getObjectCommandInput, {
          ResponseContentDisposition: "inline",
        });
      }

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand(getObjectCommandInput),
        { expiresIn }
      );
      return { url, expires: expiresIn };
    },
    {
      params: t.Object({ imageKey: t.String() }),
      query: t.Object({ download: t.Optional(t.String()) }),
      auth: { allowPublic: true },
    }
  )

  //Bulk download image
  .post(
    "/batch-download",
    async ({ body, set, user }) => {
      const { imageKeys } = body;

      const keysArray = imageKeys.filter((key: string) => key !== "");
      if (keysArray.length === 0) {
        set.status = 400;
        return { error: "No valid image keys provided for download." };
      }

      // Resolve and filter authorized keys (public or owned by requester)
      const idToKeys = new Map<string, string[]>();
      const ids: string[] = [];
      for (const k of keysArray) {
        const id = extractItemIdFromKey(k);
        if (id) {
          if (!idToKeys.has(id)) idToKeys.set(id, []);
          idToKeys.get(id)!.push(k);
          ids.push(id);
        }
      }
      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length === 0) {
        set.status = 403;
        return { error: "No authorized files for download." };
      }

      const dbRows = await db
        .select({
          id: item.id,
          createdBy: item.createdBy,
          accessType: item.accessType,
          trashedAt: item.trashedAt,
        })
        .from(item)
        .where(inArray(item.id, uniqueIds));

      const allowedIds = new Set<string>();
      for (const r of dbRows) {
        const isOwner = !!user?.id && String(r.createdBy) === String(user.id);
        const isPublic =
          String((r as any).accessType ?? "").toLowerCase() === "public";
        if (!r.trashedAt && (isPublic || isOwner)) {
          allowedIds.add(String(r.id));
        }
      }

      const allowedKeys: string[] = [];
      for (const [id, ks] of idToKeys) {
        if (allowedIds.has(id)) allowedKeys.push(...ks);
      }

      if (allowedKeys.length === 0) {
        set.status = 403;
        return { error: "No authorized files for download." };
      }

      const zipStream = new PassThrough();

      set.headers["Content-Type"] = "application/zip";
      set.headers["Content-Disposition"] = 'attachment; filename="files.zip"';

      (async () => {
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(zipStream);

        archive.on("error", (err) => {
          console.error("Archiver error:", err);
          zipStream.emit("error", err);
        });

        archive.on("warning", function (err) {
          if ((err as any).code === "ENOENT") {
            console.warn("Archiver warning (ENOENT):", err);
          } else {
            console.error("Archiver unhandled warning:", err);
            zipStream.emit("error", err);
          }
        });

        const CONCURRENCY = BATCH_DOWNLOAD_CONCURRENCY;
        const queue = [...allowedKeys];
        async function worker() {
          while (queue.length) {
            const key = queue.shift()!;
            try {
              const presignedUrl = await getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: BUCKET, Key: key }),
                { expiresIn }
              );
              const res = await fetch(presignedUrl);
              if (!res.ok)
                throw new Error(`HTTP ${res.status} for key: ${key}`);
              const fileName = key.split("/").pop() || key;
              const nodeStream = Readable.fromWeb(res.body as any);
              archive.append(nodeStream, { name: fileName });
            } catch (e) {
              console.error(`Error processing "${key}":`, e);
            }
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, allowedKeys.length) }, worker)
        );
        await archive.finalize();
      })();

      return zipStream;
    },
    {
      body: t.Object({
        imageKeys: t.Array(t.String()),
      }),
      auth: { allowPublic: true },
    }
  )

  //get bulk image (maybe optimizing for scalability ex pagination in the future??)
  .get(
    "/preview-image-keys",
    async ({ set, user }) => {
      const imageRow = await db
        .select({ key: item.id, name: item.name })
        .from(item)
        .where(eq(item.createdBy, user!.id));
      if (imageRow.length === 0) {
        set.status = 404;
        return { error: "cannot get download keys" };
      }
      const imageKeys = imageRow.map((row) => row.key);

      return { imageKeys };
    },
    {
      auth: { allowPublic: false },
    }
  )
  .post(
    "/download-image-keys",
    async ({ body, set, user }) => {
      const keys = body.keys;
      if (!keys || keys.length == 0) {
        set.status = 400;
        return { error: "keys must not be a empty array" };
      }
      const imageRow = await db
        .select({ key: item.id, name: item.name, spaceId: item.spaceId })
        .from(item)
        .where(inArray(item.id, body.keys));
      if (imageRow.length === 0) {
        set.status = 404;
        return { error: "cannot get download keys" };
      }

      const ctx = await loadAccessContext(
        db,
        user?.id ?? null,
        imageRow[0].spaceId
      );

      if (!ctx.isOwner) {
        set.status = 403;
        return { error: ERR_FORBIDDEN_WRITE };
      }

      const downloadKeys = imageRow.map((row) => row.key);
      return { downloadKeys };
    },
    {
      body: t.Object({ keys: t.Array(t.String({ format: "uuid" })) }),
      auth: { allowPublic: true },
    }
  )
  .post(
    "/delete-batch-image",
    async ({ body, set, user, query }) => {
      const { img } = body;
      if (!img || img.length == 0) {
        set.status = 400;
        return { error: "img must not be a empty array" };
      }
      const ctx = await loadAccessContext(db, user?.id ?? null, query.spaceId);
      if (!ctx.isOwner) {
        set.status = 403;
        return {
          success: false,
          error: "You do not have permission to delete images in this space.",
        };
      }

      const s3Deletion = await Promise.all(
        img.map(async ({ key, name }) => {
          const s3Key = `${key}-${name}`;
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
              })
            );
            return { s3Key, id: key, success: true };
          } catch (err) {
            return {
              key: s3Key,
              success: false,
              error: (err as Error).message,
            };
          }
        })
      );

      const dbKeys: string[] = s3Deletion
        .filter(({ success }) => success)
        .map(({ id }) => id as string);

      if (dbKeys.length > 0) {
        await db.delete(item).where(inArray(item.id, dbKeys));
      }

      return { deleted: dbKeys };
    },
    {
      body: t.Object({
        img: t.Array(t.Object({ key: t.String(), name: t.String() })),
      }),
      auth: { allowPublic: false },
    }
  )
  .post(
    "/soft-delete-image",
    async ({ body, set, query, user }) => {
      const { keys } = body;
      if (!keys || keys.length == 0) {
        set.status = 400;
        return { error: "keys must not be a empty array" };
      }
      const ctx = await loadAccessContext(db, user?.id ?? null, query.spaceId);
      if (!ctx.isOwner) {
        set.status = 403;
        return {
          success: false,
          error: "You do not have permission to delete images in this space.",
        };
      }
      const softDeleted = await db
        .update(item)
        .set({ trashedAt: sql`NOW()` })
        .where(inArray(item.id, keys))
        .returning();

      return { success: true, data: { deleteImage: softDeleted } };
    },
    {
      body: t.Object({ keys: t.Array(t.String()) }),
      auth: { allowPublic: false },
    }
  );
