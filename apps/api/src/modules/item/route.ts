import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import {
  getColumnLength,
  loadAccessContext,
  MatchType,
  scopeItemRead,
  scopeItemsRead,
  withMatch,
} from "../../utils/queryHelper";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export const itemRouter = new Elysia({ prefix: "/item" })
  .use(betterAuthMiddleware)
  .get('/item', 
    async ({ query, user, set }) => {
      try {
        const ctx = await loadAccessContext(
          db,
          user?.id ?? null,
          query.spaceId
        );

        let qb = scopeItemsRead(
          db.select().from(storageSchema.item).$dynamic(),
          ctx,
          {
            parentId: query.folderId ?? null,
            includeTrash: !!query.includeTrash,
            name: query.searchString ?? undefined,
            match: query.match ?? undefined
          }
        );

        // Drizzle returns different row shapes depending on whether we joined
        // (owner: flat item row, non-owner: { item, itemWithEffectiveAccess }).
        // Normalize to a flat item row for a consistent API contract.
        const rows = await qb.limit(1);
        const items: typeof storageSchema.item.$inferSelect[] = (rows as any[]).map((r) =>
          "item" in r ? (r.item as typeof storageSchema.item.$inferSelect) : (r as typeof storageSchema.item.$inferSelect)
        );

        const item = items[0]

        return { success: true, data: { item } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      auth: { allowPublic: true },
      query: t.Object({
        spaceId: t.String({ format: "uuid" }),
        folderId: t.Optional(t.String({ format: "uuid" })),
        includeTrash: t.Optional(t.Boolean({ default: false })),
        searchString: t.Optional(t.String({ maxLength: getColumnLength(storageSchema.item.name)})),
        match: t.Optional(t.Enum(MatchType)),
      }),
    }

  )
  .get(
    "/ancestors",
    async ({ params, query, set, user }) => {
      try {
        const ctx = await loadAccessContext(
          db,
          user?.id ?? null,
          query.spaceId
        );
        const haveAccess = await scopeItemRead(ctx, {
          itemId: query.itemId,
          includeTrash: true,
        });

        if (haveAccess.length === 0) {
          set.status = 403;
          return {
            success: false,
            data: { message: "You are not authorized to view this content" },
          };
        }

        console.log(haveAccess);

        const guard = query.spaceId
          ? sql`AND space_id = ${query.spaceId}`
          : sql``;

        const result = await db.execute(sql`
          WITH RECURSIVE parents AS (
            /* seed = the starting item (depth 0) */
            SELECT *
            FROM   ${storageSchema.item} AS i
            WHERE  i.id = ${query.itemId}
              ${guard}

            UNION ALL

            /* recursive step: climb one level up */
            SELECT p.*
            FROM   ${storageSchema.item} AS p
            JOIN   parents c ON c.parent_id = p.id
          )
          /* ignore the seed if you only want ancestors */
          SELECT *
          FROM   parents
          WHERE  id <> ${query.itemId}
          ORDER  BY created_at ASC;   -- customise: root→leaf or leaf→root
        `);

        const ancestors = result.rows;

        return {
          success: true,
          data: { ancestors: result.rows, ancestorsCount: result.rowCount },
        };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      query: t.Object({
        spaceId: t.String({ format: "uuid" }),
        parentId: t.Nullable(t.String({ format: "uuid" })),
        itemId: t.String({ format: "uuid" }),
      }),
      auth: { allowPublic: true },
    }
  )
  .post(
    "/folder",
    async ({ body, user }) => {
      const newFolder = await db
        .insert(storageSchema.item)
        .values({
          name: body.name,
          spaceId: body.spaceId,
          parentId: body.parentId,
          createdBy: user!.id,
          accessType: "owner",
        })
        .returning();

      return { success: true, data: { newFolder: newFolder } };
    },
    {
      auth: { allowPublic: false },
      body: t.Object({
        spaceId: t.String({ format: "uuid" }),
        parentId: t.Nullable(t.String({ format: "uuid" })),
        name: t.String({ maxLength: getColumnLength(storageSchema.item.name)}),
      }),
    }
  )
  .get(
    "/items",
    async ({ query, user, set }) => {
      try {
        const dirFn = query.dir === "desc" ? desc : asc;

        const sortMap = {
          name: storageSchema.item.name,
          createdAt: storageSchema.item.createdAt,
          updatedAt: storageSchema.item.updatedAt,
          sizeByte: storageSchema.item.sizeByte,
        } as const;

        if (!sortMap[query.sortField as keyof typeof sortMap]) {
          set.status = 400;
          return { success: false, error: "Invalid sortField" };
        }

        const orderCol = sortMap[query.sortField as keyof typeof sortMap];

        const ctx = await loadAccessContext(
          db,
          user?.id ?? null,
          query.spaceId
        );

        let qb = scopeItemsRead(
          db.select().from(storageSchema.item).$dynamic(),
          ctx,
          {
            parentId: query.folderId ?? null,
            includeTrash: !!query.includeTrash,
            name: query.searchString ?? undefined,
            match: query.match ?? undefined
          }
        );

        qb = qb.orderBy(dirFn(orderCol), dirFn(storageSchema.item.id));

        // Drizzle returns different row shapes depending on whether we joined
        // (owner: flat item row, non-owner: { item, itemWithEffectiveAccess }).
        // Normalize to a flat item row for a consistent API contract.
        const rows = await qb;
        const items: typeof storageSchema.item.$inferSelect[] = (rows as any[]).map((r) =>
          "item" in r ? (r.item as typeof storageSchema.item.$inferSelect) : (r as typeof storageSchema.item.$inferSelect)
        );

        return { success: true, data: { items } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      auth: { allowPublic: true },
      query: t.Object({
        spaceId: t.String({ format: "uuid" }),
        folderId: t.String({ format: "uuid" }),
        sortField: t.Optional(t.String({ default: "name" })),
        dir: t.Optional(
          t.Enum({ asc: "asc", desc: "desc" }, { default: "asc" })
        ),
        includeTrash: t.Optional(t.Boolean({ default: false })),
        searchString: t.Optional(t.String({ maxLength: getColumnLength(storageSchema.item.name)})),
        match: t.Optional(t.Enum(MatchType)),
      }),
    }
  );
