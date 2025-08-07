import { Context, Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";

import {
  betterAuthMiddleware,
  betterAuthOpenAPI,
} from "./modules/auth/route.js";
import { s3Router } from "./modules/image/route.js";
import { spaceRouter } from "./modules/space/route.js";
import cron from "@elysiajs/cron";
import { createDb } from "./drizzle/client.js";
import {sql} from 'drizzle-orm'

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

const app = new Elysia()
  .use(betterAuthMiddleware)
  .use(cron({
    name: 'alphaViewRefresh',
    pattern: '*/1 * * * * *',
    async run() {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY public.item_with_effective_access`)
    }
  }))
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://[::1]:3000",
        "http://localhost:5173",
        "http://localhost:5174",
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
  .get("/", () => "Hello Elysia")
  .listen(20257);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app