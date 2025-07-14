import { Elysia, t } from "elysia";
import { s3 } from "@repo/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET_NAME = "test";
const UPLOAD_FOLDER = "uploads";
const S3_ENDPOINT = "http://localhost:9000";

export const image = new Elysia({ prefix: "/api/image" }).post(
  "/upload",
  async ({ body, set }) => {
    const files = body.files;
    if (!files.length) {
      set.status = 400;
      return { error: "No files uploaded" };
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const key = `${UPLOAD_FOLDER}/${Date.now()}-${file.name}`;
        const buffer = await file.arrayBuffer();

        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: Buffer.from(buffer),
              ContentType: file.type,
            })
          );

          return {
            file: file.name,
            success: true,
            url: `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`,
          };
        } catch (err) {
          set.status = 500;
          console.error("Upload failed for", file.name, err);
          return {
            file: file.name,
            success: false,
            error: (err as Error).message,
          };
        }
      })
    );

    return results;
  },
  {
    body: t.Object({
      files: t.Files(),
    }),
  }
);
