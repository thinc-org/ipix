// src/routes/s3.ts -----------------------------------------------------------
import { Elysia, t } from "elysia";
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { GetFederationTokenCommand } from "@aws-sdk/client-sts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import {
  s3,
  sts,
  accessControlAllowOrigin,
  expiresIn,
  s3Region,
  s3Bucket,
} from "@repo/s3";
import { betterAuthMiddleware } from "../auth/route.js";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";

const generateKey = (fname: string) => `${crypto.randomUUID()}-${fname}`;
const isValidPartNumber = (n: number) =>
  Number.isInteger(n) && n >= 1 && n <= 10_000;

// Sanitize header values for AWS S3 metadata
// AWS S3 metadata values must be ASCII and certain characters are forbidden
const sanitizeHeaderValue = (value: string): string => {
  return value
    .replace(/[^\x20-\x7E]/g, "") // Remove non-ASCII characters
    .replace(/[\r\n\t]/g, "") // Remove control characters
    .replace(/[\"\\]/g, "") // Remove quotes and backslashes
    .trim();
};

export const s3Router = new Elysia({ prefix: "/s3" })
  .use(betterAuthMiddleware)
  .onAfterHandle(({ set }) => {
    set.headers["Access-Control-Allow-Origin"] = accessControlAllowOrigin;
  })
  // Not used yet, because MinIO does not support GetFederationTokenCommand
  .get("/sts", async ({ set }) => {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:PutObject"],
          Resource: [`arn:aws:s3:::${s3Bucket}/*`],
        },
      ],
    };
    const r = await sts.send(
      new GetFederationTokenCommand({
        Name: "placeholder",
        DurationSeconds: expiresIn,
        Policy: JSON.stringify(policy),
      })
    );
    set.headers["Cache-Control"] = `public,max-age=${expiresIn}`;
    return { credentials: r.Credentials, bucket: s3Bucket, region: s3Region };
  })

  /*
SIMPLE PUT OBJECT (non-multipart)
*/
  .get(
    "/params",
    async ({ query, set }) => {
      const { filename, type } = query as { filename?: string; type?: string };
      if (!filename || !type) {
        set.status = 400;
        return { error: "filename & type required" };
      }

      const key = generateKey(filename);
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: type,
        }),
        { expiresIn }
      );

      return { url, method: "PUT" };
    },
    { query: t.Object({ filename: t.String(), type: t.String() }), auth: true }
  )
  .post(
    "/sign",
    async ({ body, set }) => {
      const { filename, type } = body as { filename?: string; type?: string };
      if (!filename || !type) {
        set.status = 400;
        return { error: "filename & type required" };
      }

      const key = generateKey(filename);
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: type,
        }),
        { expiresIn }
      );

      return { url, method: "PUT" };
    },
    { body: t.Object({ filename: t.String(), type: t.String() }) }
  )

  /*
BATCH-OPTIMIZED ENDPOINTS FOR BULK UPLOADS (e.g., faculty photos)
*/

  /* Batch sign - optimized for bulk uploads */
  .post(
    "/batch-sign",
    async ({ body, set }) => {
      const { filename, type, size, context, timestamp } = body as {
        filename?: string;
        type?: string;
        size?: number;
        context?: string;
        timestamp?: string;
      };

      if (!filename || !type) {
        set.status = 400;
        return { error: "filename & type required" };
      }

      // Generate key with context for better organization
      const contextPrefix =
        context === "faculty-photos" ? "faculty" : "uploads";
      const datePrefix = timestamp || new Date().toISOString().slice(0, 10);
      const key = `${contextPrefix}/${datePrefix}/${crypto.randomUUID()}-${filename}`;

      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: type,
          // Add metadata for batch tracking
          Metadata: {
            "upload-context": sanitizeHeaderValue(context || "general"),
            "batch-timestamp": sanitizeHeaderValue(
              timestamp || new Date().toISOString()
            ),
            "original-filename": sanitizeHeaderValue(filename),
            "file-size": sanitizeHeaderValue(size?.toString() || "0"),
          },
        }),
        { expiresIn }
      );

      return { url, method: "PUT", key };
    },
    {
      body: t.Object({
        filename: t.String(),
        type: t.String(),
        size: t.Optional(t.Number()),
        context: t.Optional(t.String()),
        timestamp: t.Optional(t.String()),
      }),

      auth: true,
    }
  )

  /* Batch multipart - optimized for large files in bulk uploads */
  .post(
    "/batch-multipart",
    async ({ body, set }) => {
      const { filename, type, size, context, metadata } = body as {
        filename?: string;
        type?: string;
        size?: number;
        context?: string;
        metadata?: Record<string, string>;
      };

      if (!filename) {
        set.status = 400;
        return { error: "s3: content filename must be a string" };
      }
      if (!type) {
        set.status = 400;
        return { error: "s3: content type must be a string" };
      }

      // Generate key with context for better organization
      const contextPrefix =
        context === "faculty-photos" ? "faculty" : "uploads";
      const datePrefix = new Date().toISOString().slice(0, 10);
      const key = `${contextPrefix}/${datePrefix}/${crypto.randomUUID()}-${filename}`;

      // Clean and merge provided metadata with batch-specific metadata
      const cleanedMetadata: Record<string, string> = {};
      if (metadata) {
        // Filter out null/undefined values and convert all to strings with sanitization
        Object.entries(metadata).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            cleanedMetadata[key] = sanitizeHeaderValue(String(value));
          }
        });
      }

      const enhancedMetadata = {
        "upload-context": sanitizeHeaderValue(context || "general"),
        "batch-timestamp": sanitizeHeaderValue(new Date().toISOString()),
        "original-filename": sanitizeHeaderValue(filename),
        "file-size": sanitizeHeaderValue(size?.toString() || "0"),
        "upload-type": sanitizeHeaderValue("batch-multipart"),
        ...cleanedMetadata,
      };

      const r = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: type,
          Metadata: enhancedMetadata,
        })
      );

      return { key: r.Key, uploadId: r.UploadId };
    },
    {
      body: t.Object({
        filename: t.String(),
        type: t.String(),
        size: t.Optional(t.Number()),
        context: t.Optional(t.String()),
        metadata: t.Optional(
          t.Record(t.String(), t.Union([t.String(), t.Null()]))
        ),
      }),

      auth: true,
    }
  )

  /* Batch multipart - presign each part */
  .get(
    "/batch-multipart/:uploadId/:partNumber",
    async ({ params, query, set }) => {
      const part = Number(params.partNumber);
      if (!isValidPartNumber(part)) {
        set.status = 400;
        return { error: "partNumber 1-10000" };
      }
      const key = query.key as string | undefined;
      if (!key) {
        set.status = 400;
        return { error: "?key=objectKey is required" };
      }

      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: s3Bucket,
          Key: key,
          UploadId: params.uploadId,
          PartNumber: part,
          Body: "", // Body is ignored for presign
        }),
        { expiresIn }
      );
      return { url, expires: expiresIn };
    },
    {
      params: t.Object({ uploadId: t.String(), partNumber: t.String() }),
      query: t.Object({ key: t.String() }),

      auth: true,
    }
  )

  /* Batch multipart - list already uploaded parts */
  .get(
    "/batch-multipart/:uploadId",
    async ({ params, query, set }) => {
      const key = query.key as string | undefined;
      if (!key) {
        set.status = 400;
        return { error: "?key required" };
      }
      const parts: any[] = [];
      const listPage = async (marker?: string): Promise<void> => {
        const r = await s3.send(
          new ListPartsCommand({
            Bucket: s3Bucket,
            Key: key,
            UploadId: params.uploadId,
            PartNumberMarker: marker,
          })
        );
        parts.push(...r.Parts!);
        if (r.IsTruncated) await listPage(r.NextPartNumberMarker);
      };
      await listPage();
      return parts;
    },
    {
      params: t.Object({ uploadId: t.String() }),
      query: t.Object({ key: t.String() }),
      auth: true,
    }
  )

  /* Batch multipart - complete upload */
  .post(
    "/batch-multipart/:uploadId/complete",
    async ({ params, query, body, set }) => {
      const key = query.key as string | undefined;
      const parts = body.parts as
        | { PartNumber: number; ETag: string }[]
        | undefined;
      if (!key) {
        set.status = 400;
        return { error: "?key required" };
      }
      if (
        !Array.isArray(parts) ||
        !parts.every((p) => p.PartNumber && p.ETag)
      ) {
        set.status = 400;
        return { error: "parts must be [{PartNumber,ETag}]" };
      }

      const r = await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: s3Bucket,
          Key: key,
          UploadId: params.uploadId,
          MultipartUpload: { Parts: parts },
        })
      );
      return { location: r.Location };
    },
    {
      params: t.Object({ uploadId: t.String() }),
      query: t.Object({ key: t.String() }),
      body: t.Object({
        parts: t.Array(t.Object({ PartNumber: t.Number(), ETag: t.String() })),
      }),
      auth: true,
    }
  )

  /* Batch multipart - abort upload */
  .delete(
    "/batch-multipart/:uploadId",
    async ({ params, query, set }) => {
      const key = query.key as string | undefined;
      if (!key) {
        set.status = 400;
        return { error: "?key required" };
      }
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: s3Bucket,
          Key: key,
          UploadId: params.uploadId,
        })
      );
      return {};
    },
    {
      params: t.Object({ uploadId: t.String() }),
      query: t.Object({ key: t.String() }),

      auth: true,
    }
  )

  //Get single image
  .get(
    "/image/:imageKey",
    async ({ params, set, query }) => {
      const { imageKey } = params;
      const { download } = query;

      const getObjectCommandInput = {
        Bucket: s3Bucket,
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
    }
  )

  //Bulk download image
  .post(
    "/batch-download",
    async ({ body, set }) => {
      const { imageKeys } = body;

      const keysArray = imageKeys.filter((key: string) => key !== "");

      if (keysArray.length === 0) {
        set.status = 400;
        return { error: "No valid image keys provided for download." };
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
          if (err.code === "ENOENT") {
            console.warn("Archiver warning (ENOENT):", err);
          } else {
            console.error("Archiver unhandled warning:", err);
            zipStream.emit("error", err);
          }
        });

        await Promise.allSettled(
          keysArray.map(async (key) => {
            try {
              const presignedUrl = await getSignedUrl(
                s3,
                new GetObjectCommand({
                  Bucket: s3Bucket,
                  Key: key,
                }),
                { expiresIn }
              );

              const response = await fetch(presignedUrl);

              if (!response.ok) {
                throw new Error(
                  `HTTP error status: ${response.status} for key: ${key}`
                );
              }

              const webStream = response.body;

              if (webStream) {
                const nodeStream = Readable.from(webStream);
                nodeStream.on("error", (err) => {
                  console.error(`Stream error for ${key}:`, err);
                });
                const fileName = key.split("/").pop() || key;
                archive.append(nodeStream, { name: fileName });
              } else {
                console.warn(`Fetch response body is null for key: ${key}`);
              }
            } catch (err: any) {
              console.error(`Error processing file "${key}":`, err);
            }
          })
        );

        await archive.finalize();
      })();

      return zipStream;
    },
    {
      body: t.Object({
        imageKeys: t.Array(t.String()),
      }),
    }
  )

  //get bulk image (maybe optimizing for scalability ex pagination in the future??)
  .post(
    "/batch-image",
    async ({ body }) => {
      const { keys } = body;

      const signedUrls = await Promise.all(
        keys.map(async (encodedKey: string) => {
          const imageKey = decodeURIComponent(encodedKey);

          const getObjectCommandInput = {
            Bucket: s3Bucket,
            Key: imageKey,
          };

          try {
            const url = await getSignedUrl(
              s3,
              new GetObjectCommand(getObjectCommandInput),
              { expiresIn }
            );
            return { key: imageKey, url, expires: expiresIn };
          } catch (err) {
            return { key: imageKey, error: "Could not generate signed URL" };
          }
        })
      );

      return { signedUrls };
    },
    {
      body: t.Object({ keys: t.Array(t.String()) }),
    }
  );
