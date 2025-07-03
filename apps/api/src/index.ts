import { Context, Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import 'dotenv/config';

import { auth, OpenAPI } from "./modules/auth/router.js";

const betterAuthMiddleware = new Elysia({ name: 'better-auth' })
    .all('/api/auth/*', (context: Context) => {
        if (['POST', 'GET'].includes(context.request.method)) {
            return auth.handler(context.request);
        }

        context.status(405);
    })

    .macro({
        auth: {
            async resolve({ status, request: { headers } }) {
                const session = await auth.api.getSession({
                    headers,
                });

                if (!session) {
                    return status(401);
                }

                return {
                    user: session.user,
                    session: session.session,
                };
            },
        },
    });



const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:5173","http://localhost:5174"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(betterAuthMiddleware)
  .use(
    swagger({
      documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    })
  )
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
