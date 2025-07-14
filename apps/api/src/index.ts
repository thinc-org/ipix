import { Context, Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";

import {
  betterAuthMiddleware,
  betterAuthOpenAPI,
} from "./modules/auth/route.js";
import { image } from "./modules/image/route.js";

const app = new Elysia()
  .use(betterAuthMiddleware)
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
  .use(image)
  .get("/", () => "Hello Elysia")
  .listen(20257);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
