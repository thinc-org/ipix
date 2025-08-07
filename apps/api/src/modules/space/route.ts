import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { eq } from "drizzle-orm";
import { storageTable } from "@repo/rdb/schema";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export const spaceRouter = new Elysia({ prefix: "/space" })
  .use(betterAuthMiddleware)
  .get(
    "/associated-space",
    async ({ params, query, set, user }) => {
      try {
        const mySpace = await db
          .select()
          .from(storageTable.space)
          .where(eq(storageTable.space.ownedBy, user.id));
        return {success: true, data: {mySpace: mySpace}};
      } catch(e) {
        set.status = 500
        return { success: false, data: {error: e}}
      }
    },
    {
      auth: true,
    }
  )
  .post(
    "/create-space",
    async ({ body, set, user }) => {
      try {

        const newSpace = await db.insert(storageTable.space).values({
          name: body.name,
          type: body.spaceType,
          accessType: body.accessType,
          createdBy: user.id,
          ownedBy: user.id,
        });
        return {success: true, data: {newSpace: newSpace}};
      } catch(e) {
        set.status = 500
        return { success: false, data: {error: e}}
      }
    },
    {
      body: t.Object({
        name: t.String({ maxLength: storageTable.space.name.dataType.length }),
        spaceType: t.Enum(
          Object.fromEntries(
            storageTable.space.type.enumValues.map((val) => [val, val])
          )
        ),
        accessType: t.Enum(
          Object.fromEntries(
            storageTable.space.accessType.enumValues.map((val) => [val, val])
          )
        ),
      }),
      auth: true,
    }
  );

