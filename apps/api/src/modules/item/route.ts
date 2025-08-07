import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { eq } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import { MatchType, withMatch } from "../../utils/dynamicQueryHelper";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export const spaceRouter = new Elysia({ prefix: "/item" })
  .use(betterAuthMiddleware)
  .get(
    "item/:itemId",
    async ({ set }) => {
      try {
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    { auth: true }
  )
  .get(
    "/items",
    async ({ query, user }) => {
      try {
        const permission = db
          .select()
          .from(storageSchema.itemWithEffectiveAccess)
          .where(eq(storageSchema.itemWithEffectiveAccess.id, query.folder));
        let queryDb = db
          .select()
          .from(storageSchema.item)
          .where(eq(storageSchema.item.parentId, query.folder));
      } catch (e) {}
    },
    {
      auth: true,
      query: t.Object({
        folder: t.String({ format: "uuid" }),
      }),
    }
  )
  .get(
    "/parents",
    async ({ params, query, set, user }) => {
      try {
        let queryDb = db
          .select()
          .from(storageSchema.space)
          .where(eq(storageSchema.space.ownedBy, user.id))
          .$dynamic();
        if (query.match && query.name) {
          queryDb = withMatch(
            queryDb,
            storageSchema.space.name,
            query.match,
            query.name
          );
        }
        const mySpace = await queryDb;
        return { success: true, data: { mySpace: mySpace } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      query: t.Optional(
        t.Object({
          name: t.String(),
          match: t.Enum(MatchType),
        })
      ),
      auth: true,
    }
  )
  .post("/folder", async ({ body }) => {}, { auth: true, body: t.Object({
    name: t.String({})
  }) });
