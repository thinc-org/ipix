import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { eq } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import { MatchType, withMatch } from "../../utils/queryHelper";
import { citextConfig } from "../../../../../packages/rdb/src/schemas/storage";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

// Versioned space routes: /v1/spaces
export const spaceRouter = new Elysia({ prefix: "/v1" })
  .use(betterAuthMiddleware)
  .get(
  "/spaces",
    async ({ params, query, set, user }) => {
      try {
        let queryDb = db
          .select()
          .from(storageSchema.space)
          .where(eq(storageSchema.space.ownedBy, user!.id))
          .$dynamic();
        if (query.match && query.searchString) {
          const matchColumn =
            query.match === MatchType.ID
              ? storageSchema.space.id
              : storageSchema.space.name;
          queryDb = withMatch(
            queryDb,
            matchColumn,
            query.match,
            query.searchString
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
          searchString: t.String({
            minLength: citextConfig.minLength,
            maxLength: citextConfig.maxLength,
          }),
          match: t.Enum(MatchType),
        })
      ),
      auth: { allowPublic: false },
    }
  )
  .post(
  "/spaces",
    async ({ body, set, user }) => {
      try {
        // Create root folder item and space with cross references in a single transaction
        const result = await db.transaction(async (tx) => {
          const spaceId = randomUUID();
          const rootItemId = randomUUID();

          const [newSpace] = await tx
            .insert(storageSchema.space)
            .values({
              id: spaceId,
              name: body.name,
              ownershipType: body.ownershipType,
              rootFolderId: rootItemId,
              createdBy: user!.id,
              ownedBy: user!.id,
            })
            .returning();

          const [rootFolder] = await tx
            .insert(storageSchema.item)
            .values({
              id: rootItemId,
              parentId: null,
              spaceId: spaceId,
              createdBy: user!.id,
              name: body.name,
              itemType: "folder",
            })
            .returning();

          return { newSpace, rootFolder };
        });

        return { success: true, data: result };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      body: t.Object({
        name: t.String({
          minLength: citextConfig.minLength,
          maxLength: citextConfig.maxLength,
        }),
        ownershipType: t.Enum(
          Object.fromEntries(
            storageSchema.space.ownershipType.enumValues.map((val) => [
              val,
              val,
            ])
          )
        ),
      }),
      auth: { allowPublic: false },
    }
  );
