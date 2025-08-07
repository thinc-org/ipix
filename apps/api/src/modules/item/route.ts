import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import { MatchType, withMatch } from "../../utils/dynamicQueryHelper";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export const itemRouter = new Elysia({ prefix: "/item" })
  .use(betterAuthMiddleware)
  .get(
    "/items",
    async ({ query, user, set }) => {
      try {
        const dirFn = query.dir === "desc" ? desc : asc;
        const accessFilter = or(
          eq(storageSchema.itemWithEffectiveAccess.effectiveAccess, "public"),
          and(
            eq(storageSchema.itemWithEffectiveAccess.effectiveAccess, "team")
            /*           exists(
            db
              .select({ one: sql`1` })
              .from(storage.spaceMember)
              .where(and(
                eq(storage.spaceMember.spaceId, spaceId),
                eq(storage.spaceMember.userId, user.id)
              ))
          ) */
          ),
          and(
            eq(storageSchema.itemWithEffectiveAccess.effectiveAccess, "owner"),
            eq(storageSchema.space.ownedBy, user.id)
          )
        );

        const where = and(
          eq(storageSchema.item.spaceId, query.spaceId),
          query.folderId === null
            ? isNull(storageSchema.item.parentId)
            : eq(storageSchema.item.parentId, query.folderId),
          query.includeTrash
            ? sql`TRUE`
            : isNull(storageSchema.item.trashedDeleteDT),
          accessFilter
        );

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

        const items = await db
          .select()
          .from(storageSchema.item)
          .innerJoin(
            storageSchema.itemWithEffectiveAccess,
            and(
              eq(
                storageSchema.item.id,
                storageSchema.itemWithEffectiveAccess.id
              ),
              eq(
                storageSchema.item.spaceId,
                storageSchema.itemWithEffectiveAccess.spaceId
              )
            )
          )
          .innerJoin(
            storageSchema.space,
            eq(storageSchema.space.id, storageSchema.item.spaceId)
          )
          .where(where)
          .orderBy(dirFn(orderCol), dirFn(storageSchema.item.id));

        return { success: true, data: { items: items } };
      } catch (e) {
        set.status = 500;
        return { success: false, data: { error: e } };
      }
    },
    {
      auth: true,
      query: t.Object({
        spaceId: t.String({ format: "uuid" }),
        folderId: t.String({ format: "uuid" }),
        sortField: t.Optional(t.String({ default: "name" })),
        dir: t.Optional(
          t.Enum({ asc: "asc", desc: "desc" }, { default: "asc" })
        ),
        includeTrash: t.Optional(t.Boolean({ default: false })),
      }),
    }
  )
  .post(
    "/folder",
    async ({ body, user }) => {
      const newFolder = await db.insert(storageSchema.item).values({
        name: body.name,
        spaceId: body.spaceId,
        parentId: body.parentId,
        createdBy: user.id,
        accessType: "owner",
      }).returning();

      return {success: true, data: {newFolder: newFolder}};
    },
    {
      auth: true,
      body: t.Object({
        spaceId:  t.String({ format: "uuid" }),
        parentId: t.Nullable(t.String({ format: "uuid" })),
        name: t.String({}),
      }),
    }
  );
