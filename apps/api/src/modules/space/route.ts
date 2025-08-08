import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { eq } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import { MatchType, withMatch } from "../../utils/dynamicQueryHelper";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export const spaceRouter = new Elysia({ prefix: "/space" })
  .use(betterAuthMiddleware)
  .get(
    "/associated-space",
    async ({ params, query, set, user }) => {
      try {
        let queryDb = db
          .select()
          .from(storageSchema.space)
          .where(eq(storageSchema.space.ownedBy, user!.id))
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
      query: t.Optional(t.Object({
        name: t.String(),
        match: t.Enum(MatchType),
      })),
      auth: {allowPublic: false},
    }
  )
  .post(
    "/create-space",
    async ({ body, set, user }) => {
      try {
        const newSpace = await db.insert(storageSchema.space).values({
          name: body.name,
          type: body.spaceType,
          accessType: body.accessType,
          createdBy: user!.id,
          ownedBy: user!.id,
        });
        return { success: true, data: { newSpace: newSpace } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      body: t.Object({
        name: t.String({ maxLength: storageSchema.space.name.dataType.length }),
        spaceType: t.Enum(
          Object.fromEntries(
            storageSchema.space.type.enumValues.map((val) => [val, val])
          )
        ),
        accessType: t.Enum(
          Object.fromEntries(
            storageSchema.space.accessType.enumValues.map((val) => [val, val])
          )
        ),
      }),
      auth: {allowPublic: false},
    }
  );
