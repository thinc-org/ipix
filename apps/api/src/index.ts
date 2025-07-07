import { Context, Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import 'dotenv/config';

import { betterAuthMiddleware, betterAuthOpenAPI } from "./modules/auth/route.js";




const app = new Elysia()
  .use(betterAuthMiddleware)
  .use(
    cors({
      origin: ["http://localhost:5173","http://localhost:5174"],
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
  .get("/", () => "Hello Elysia")
  .listen(20257);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
