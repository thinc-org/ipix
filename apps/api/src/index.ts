import { Context, Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";

import {
  betterAuthMiddleware,
  betterAuthOpenAPI,
} from "./modules/auth/route.js";
import { s3Router } from "./modules/image/download.js";
import { spaceRouter } from "./modules/space/route.js";
import { itemRouter } from "./modules/item/route.js";
import cron from "@elysiajs/cron";
import { createDb } from "./drizzle/client.js";
import { sql } from "drizzle-orm";
import { uploadRouter } from "./modules/image/upload-multipart.js";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

const app = new Elysia()
  .use(betterAuthMiddleware)
  .use(
    cron({
      name: "alphaRecalcQueueDelete",
      pattern: "0 */4 * * *",
      async run() {
        await db.execute(
          sql`DELETE FROM item_effective_recalc_queue WHERE enqueued_at < now() - interval '2 days';`
        );
      },
    })
  )
  .use(
    cors({
      origin: [
        // "http://localhost:3000",
        // "http://[::1]:3000",
        // "http://localhost:5173",
        // "http://localhost:5174",
        `${process.env.ACCESS_CONTROL_ALLOW_ORIGIN!}`,
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    swagger({
      documentation: {
        components: await betterAuthOpenAPI.components,
        paths: await betterAuthOpenAPI.getPaths(),
      },
    })
  )
  .use(s3Router)
  .use(spaceRouter)
  .use(itemRouter)
  .use(uploadRouter)
  .get("/", () => "Hello Elysia")
  .listen(20257);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
