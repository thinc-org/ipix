import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { and, asc, desc, eq, isNull, sql, inArray, lte } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import {
  loadAccessContext,
  MatchType,
  scopeItemRead,
  scopeItemsRead,
} from "../../utils/queryHelper";
import { citextConfig } from "../../../../../packages/rdb/src/schemas/storage";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

// Versioned, nested routes: /v1/spaces/:spaceId/items
export const itemRouter = new Elysia({ prefix: "/v1" })
  .use(betterAuthMiddleware)
  // GET /v1/spaces/:spaceId/items/:itemId - fetch a single item; if folder, include direct childCount
  .get(
    "/spaces/:spaceId/items/:itemId",
    async ({ params, query, user, set }) => {
      try {
        const ctx = await loadAccessContext(db, user?.id ?? null, params.spaceId);

        // Authorization check for item visibility within the space
        const haveAccess = await scopeItemRead(ctx, {
          itemId: params.itemId,
          includeTrash: !!query?.includeTrash,
        });
        if (haveAccess.length === 0) {
          set.status = 403;
          return { success: false, data: { message: "You are not authorized to view this content" } };
        }

        const rows = await db
          .select()
          .from(storageSchema.item)
          .where(and(eq(storageSchema.item.spaceId, params.spaceId), eq(storageSchema.item.id, params.itemId)));
        const item = rows[0] as typeof storageSchema.item.$inferSelect | undefined;

        if (!item) {
          set.status = 404;
          return { success: false, data: { message: "Item not found" } };
        }

        if (item.itemType === "folder") {
          const childCountRow = await (async () => {
            if (ctx.isOwner) {
              const res = await db
                .select({ count: sql<number>`cast(count(*) as int)` })
                .from(storageSchema.item)
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    eq(storageSchema.item.parentId, item.id),
                    query?.includeTrash ? sql`TRUE` : isNull(storageSchema.item.purgeAt)
                  )
                );
              return res[0];
            } else {
              const res = await db
                .select({ count: sql<number>`cast(count(*) as int)` })
                .from(storageSchema.item)
                .innerJoin(
                  storageSchema.itemEffectiveAccess,
                  and(
                    eq(storageSchema.itemEffectiveAccess.id, storageSchema.item.id),
                    eq(storageSchema.itemEffectiveAccess.spaceId, storageSchema.item.spaceId),
                    lte(storageSchema.itemEffectiveAccess.effectiveRank, 1000)
                  )
                )
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    eq(storageSchema.item.parentId, item.id),
                    query?.includeTrash ? sql`TRUE` : isNull(storageSchema.item.purgeAt)
                  )
                );
              return res[0];
            }
          })();

          const withCount = { ...(item as any), childCount: childCountRow ? Number((childCountRow as any).count) : 0 };
          return { success: true, data: { item: withCount } };
        }

        return { success: true, data: { item } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      auth: { allowPublic: true },
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
      }),
      query: t.Optional(
        t.Object({
          includeTrash: t.Optional(t.Boolean({ default: false })),
        })
      ),
    }
  )
  .get(
    "/spaces/:spaceId/items/:itemId/ancestors",
    async ({ params, set, user }) => {
      try {
        const ctx = await loadAccessContext(db, user?.id ?? null, params.spaceId);
        const haveAccess = await scopeItemRead(ctx, {
          itemId: params.itemId,
          includeTrash: true,
        });

        if (haveAccess.length === 0) {
          set.status = 403;
          return {
            success: false,
            data: { message: "You are not authorized to view this content" },
          };
        }

        const guard = params.spaceId ? sql`AND space_id = ${params.spaceId}` : sql``;

        const result = await db.execute(sql`
          WITH RECURSIVE parents AS (
            /* seed = the starting item (depth 0) */
            SELECT *
            FROM   ${storageSchema.item} AS i
            WHERE  i.id = ${params.itemId}
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
          WHERE  id <> ${params.itemId}
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
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
        itemId: t.String({ format: "uuid" }),
      }),
      auth: { allowPublic: true },
    }
  )
  .post(
    "/spaces/:spaceId/items/folders",
    async ({ params, body, user }) => {
      const newFolder = await db
        .insert(storageSchema.item)
        .values({
          name: body.name,
          spaceId: params.spaceId,
          parentId: body.parentId,
          createdBy: user!.id,
          accessType: "owner",
          itemType: "folder",
        })
        .returning();

      return { success: true, data: { newFolder: newFolder } };
    },
    {
      auth: { allowPublic: false },
      body: t.Object({
        parentId: t.Nullable(t.String({ format: "uuid" })),
        name: t.String({ minLength: citextConfig.minLength, maxLength: citextConfig.maxLength}),
      }),
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
      }),
    }
  )
  .get(
    "/spaces/:spaceId/items",
    async ({ params, query, user, set }) => {
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

  const ctx = await loadAccessContext(db, user?.id ?? null, params.spaceId);

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

        // If any of the fetched items are folders, compute their direct child counts
        const folderIds = items.filter((it) => it.itemType === "folder").map((it) => it.id);

        let itemsOut: Array<typeof storageSchema.item.$inferSelect & { childCount?: number }>; // response payload

        if (folderIds.length === 0) {
          itemsOut = items;
        } else {
          // Build a map of folderId -> direct children count with the same visibility rules and trash filter
          const childCountRows = await (async () => {
            if (ctx.isOwner) {
              return await db
                .select({
                  parentId: storageSchema.item.parentId,
                  count: sql<number>`cast(count(*) as int)`,
                })
                .from(storageSchema.item)
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    inArray(storageSchema.item.parentId, folderIds),
                    query.includeTrash ? sql`TRUE` : isNull(storageSchema.item.purgeAt)
                  )
                )
                .groupBy(storageSchema.item.parentId);
            } else {
              return await db
                .select({
                  parentId: storageSchema.item.parentId,
                  count: sql<number>`cast(count(*) as int)`,
                })
                .from(storageSchema.item)
                .innerJoin(
                  storageSchema.itemEffectiveAccess,
                  and(
                    eq(storageSchema.itemEffectiveAccess.id, storageSchema.item.id),
                    eq(storageSchema.itemEffectiveAccess.spaceId, storageSchema.item.spaceId),
                    lte(storageSchema.itemEffectiveAccess.effectiveRank, 1000)
                  )
                )
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    inArray(storageSchema.item.parentId, folderIds),
                    query.includeTrash ? sql`TRUE` : isNull(storageSchema.item.purgeAt)
                  )
                )
                .groupBy(storageSchema.item.parentId);
            }
          })();

          const countsMap = new Map<string, number>();
          for (const row of childCountRows as Array<{ parentId: string | null; count: number }>) {
            if (row.parentId) countsMap.set(row.parentId, Number(row.count));
          }

          itemsOut = items.map((it) =>
            it.itemType === "folder"
              ? ({ ...it, childCount: countsMap.get(it.id) ?? 0 } as typeof it & {
                  childCount: number;
                })
              : it
          );
        }

        return { success: true, data: { items: itemsOut } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      auth: { allowPublic: true },
      query: t.Object({
        folderId: t.String({ format: "uuid" }),
        sortField: t.Optional(t.String({ default: "name" })),
        dir: t.Optional(
          t.Enum({ asc: "asc", desc: "desc" }, { default: "asc" })
        ),
        includeTrash: t.Optional(t.Boolean({ default: false })),
        searchString: t.Optional(t.String({ minLength: citextConfig.minLength, maxLength: citextConfig.maxLength})),
        match: t.Optional(t.Enum(MatchType)),
      }),
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
      }),
    }
  );
