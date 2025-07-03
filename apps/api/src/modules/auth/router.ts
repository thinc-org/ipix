import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from 'better-auth/plugins';
import { createDb } from "../../drizzle/client.js";
import { authTable } from "@repo/rdb/schema";

export const auth = betterAuth({
  database: drizzleAdapter(createDb, {
    provider: "sqlite", // or "mysql", "sqlite"
    schema: authTable
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    openAPI() // Add the openAPI plugin here
  ],
});

// Add the OpenAPI utility functions
let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema())

export const OpenAPI = {
    getPaths: (prefix = '/api/auth') =>
        getSchema().then(({ paths }) => {
            const reference: typeof paths = Object.create(null)

            for (const path of Object.keys(paths)) {
                const key = prefix + path
                reference[key] = paths[path]

                for (const method of Object.keys(paths[path])) {
                    const operation = (reference[key] as any)[method]

                    operation.tags = ['Better Auth']
                }
            }

            return reference
        }) as Promise<any>,
    components: getSchema().then(({ components }) => components) as Promise<any>
} as const