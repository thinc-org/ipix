import { Context, Elysia, t } from "elysia";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { createDb } from "../../drizzle/client.js";
import { authTable } from "@repo/rdb/schema";

export const auth = betterAuth({
  baseURL: "http://localhost:3000/auth",
  trustedOrigins: ["http://localhost:3000", "http://[::1]:3000"],
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false, // Set to true in production with HTTPS
    },
    redirectProxy: {
      enabled: true,
      url: "http://localhost:3000/auth?callback=true", // Add a query param to identify callback
    },
    database: {
      generateId: (options: {}) => {
        return crypto.randomUUID();
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  database: drizzleAdapter(
    createDb({
      databaseUrl: process.env.DATABASE_URL,
    }),
    {
      provider: "pg",
      schema: authTable,
    }
  ),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: "http://localhost:20257/api/auth/callback/google",
      accessType: "offline",
      prompt: "select_account",
    },
  },
  plugins: [openAPI()],
});

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

export const betterAuthOpenAPI = {
  getPaths: (prefix = "/api/auth") =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method];

          operation.tags = ["Better Auth"];
        }
      }

      return reference;
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;

export const betterAuthMiddleware = new Elysia({ name: "better-auth" })
  .all("/api/auth/*", async (context: Context) => {
    if (["POST", "GET"].includes(context.request.method)) {
      const response = await auth.handler(context.request);

      // If it's a redirect response, make sure to return it properly
      if (response && response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (location) {
          console.log("Redirecting to:", location);
          return new Response(null, {
            status: response.status,
            headers: {
              Location: location,
              "Set-Cookie": response.headers.get("Set-Cookie") || "",
            },
          });
        }
      }

      return response;
    }

    context.status(405);
  })
  .mount(auth.handler)
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
