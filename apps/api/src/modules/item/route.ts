import { Elysia, t } from "elysia";
import { betterAuthMiddleware } from "../auth/route";
import { createDb } from "../../drizzle/client";
import { and, asc, desc, eq, isNull, sql, inArray, lte } from "drizzle-orm";
import { storageSchema } from "@repo/rdb/schema";
import {
  getDescendantItemIds,
  loadAccessContext,
  MatchType,
  scopeItemRead,
  scopeItemsRead,
} from "../../utils/queryHelper";
import { citextConfig } from "@repo/rdb/types";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, s3Bucket, expiresIn } from "@repo/s3";
import {
  fileAsset,
  item,
} from "../../../../../packages/rdb/src/schemas/storage";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

// Versioned, nested routes: /v1/spaces/:spaceId/items
export const itemRouter = new Elysia({ prefix: "/v1" })
  .use(betterAuthMiddleware)
  // GET /v1/spaces/:spaceId/items/:itemId - fetch a single item; if folder, include direct childCount
  .get(
    "/spaces/:spaceId/items/:itemId",
    async ({ params, query, user, set }) => {
      try {
        const ctx = await loadAccessContext(
          db,
          user?.id ?? null,
          params.spaceId
        );

        // Authorization check for item visibility within the space
        const haveAccess = await scopeItemRead(ctx, {
          itemId: params.itemId,
          includeTrash: !!query?.includeTrash,
        });
        if (haveAccess.length === 0) {
          set.status = 403;
          return {
            success: false,
            data: { message: "You are not authorized to view this content" },
          };
        }

        const rows = await db
          .select()
          .from(storageSchema.item)
          .where(
            and(
              eq(storageSchema.item.spaceId, params.spaceId),
              eq(storageSchema.item.id, params.itemId)
            )
          );
        const item = rows[0] as
          | typeof storageSchema.item.$inferSelect
          | undefined;

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
                    query?.includeTrash
                      ? sql`TRUE`
                      : isNull(storageSchema.item.purgeAt)
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
                    eq(
                      storageSchema.itemEffectiveAccess.id,
                      storageSchema.item.id
                    ),
                    eq(
                      storageSchema.itemEffectiveAccess.spaceId,
                      storageSchema.item.spaceId
                    ),
                    lte(storageSchema.itemEffectiveAccess.effectiveRank, 1000)
                  )
                )
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    eq(storageSchema.item.parentId, item.id),
                    query?.includeTrash
                      ? sql`TRUE`
                      : isNull(storageSchema.item.purgeAt)
                  )
                );
              return res[0];
            }
          })();

          const withCount = {
            ...item,
            childCount: childCountRow ? Number(childCountRow.count) : 0,
          };
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
        name: t.String({
          minLength: citextConfig.minLength,
          maxLength: citextConfig.maxLength,
        }),
      }),
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
      }),
    }
  )
  // Create file placeholder
  .post(
    "/spaces/:spaceId/items/files",
    async ({ params, body, user, set }) => {
      try {
        const ctx = await loadAccessContext(db, user!.id, params.spaceId);

        // Authorization: require space-level write (owner)
        if (!ctx.isOwner) {
          set.status = 403;
          return {
            message: "You are not authorized to create files in this space",
          };
        }

        // Validate parent if provided
        if (body.parentId) {
          const parentRows = await db
            .select({
              id: storageSchema.item.id,
              itemType: storageSchema.item.itemType,
              purgeAt: storageSchema.item.purgeAt,
              spaceId: storageSchema.item.spaceId,
            })
            .from(storageSchema.item)
            .where(
              and(
                eq(storageSchema.item.id, body.parentId),
                eq(storageSchema.item.spaceId, params.spaceId)
              )
            );

          const parent = parentRows[0];
          if (!parent) {
            set.status = 400;
            return { message: "Invalid parentId" };
          }
          if (parent.itemType !== "folder") {
            set.status = 400;
            return { message: "Parent must be a folder" };
          }
          if (parent.purgeAt !== null) {
            set.status = 400;
            return { message: "Parent folder is in trash" };
          }
        }

        // Normalize MIME type to lowercase
        const normalizedMime = body.contentType.trim().toLowerCase();

        const inserted = await db
          .insert(storageSchema.item)
          .values({
            name: body.name,
            spaceId: params.spaceId,
            parentId: body.parentId,
            createdBy: user!.id,
            accessType: "owner",
            itemType: "file",
            fileState: "placeholder",
            mimeType: normalizedMime,
            sizeByte: null,
            assetId: null,
          })
          .returning();

        const created = inserted[0];

        set.status = 201;
        return {
          item: {
            id: created.id,
            spaceId: created.spaceId,
            parentId: created.parentId,
            itemType: created.itemType,
            fileState: created.fileState,
            mimeType: created.mimeType,
            sizeByte:
              created.sizeByte === null ? null : String(created.sizeByte),
            createdAt: new Date(created.createdAt).toISOString(),
          },
        };
      } catch (e) {
        set.status = 500;
        return { message: "Internal Server Error" };
      }
    },
    {
      auth: { allowPublic: false },
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        parentId: t.String({ format: "uuid" }),
        name: t.String({
          minLength: citextConfig.minLength,
          maxLength: citextConfig.maxLength,
        }),
        contentType: t.String({
          minLength: citextConfig.minLength,
          maxLength: citextConfig.maxLength,
        }),
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

        const ctx = await loadAccessContext(
          db,
          user?.id ?? null,
          params.spaceId
        );

        // Ensure caller can access the folder itself (mirror /ancestors auth)
        const canAccessFolder = await scopeItemRead(ctx, {
          itemId: query.folderId,
          includeTrash: true,
        });
        if (canAccessFolder.length === 0) {
          set.status = 403;
          return {
            success: false,
            data: { message: "You are not authorized to view this content" },
          };
        }

        let qb = scopeItemsRead(
          db.select().from(storageSchema.item).$dynamic(),
          ctx,
          {
            parentId: query.folderId ?? null,
            includeTrash: !!query.includeTrash,
            name: query.searchString ?? undefined,
            match: query.match ?? undefined,
          }
        );

        qb = qb.orderBy(dirFn(orderCol), dirFn(storageSchema.item.id));

        // Drizzle returns different row shapes depending on whether we joined
        // (owner: flat item row, non-owner: { item, itemWithEffectiveAccess }).
        // Normalize to a flat item row for a consistent API contract.
        const rows = await qb;
        let items: (typeof storageSchema.item.$inferSelect)[] = (
          rows as any[]
        ).map((r) =>
          "item" in r
            ? (r.item as typeof storageSchema.item.$inferSelect)
            : (r as typeof storageSchema.item.$inferSelect)
        );

        // If any of the fetched items are folders, compute their direct child counts
        const folderIds = items
          .filter((it) => it.itemType === "folder")
          .map((it) => it.id);

        // If any of the fetched items are files, convert BigInt size to string
        type ItemDTO = Omit<
          typeof storageSchema.item.$inferSelect,
          "sizeByte"
        > & {
          childCount?: number;
          sizeByte: string | null;
          previewUrl?: string | null;
        };

        const dto: ItemDTO[] = items.map<ItemDTO>((it) => ({
          ...it,
          sizeByte: it.sizeByte ? it.sizeByte.toString() : null,
        }));

        let itemsOut: ItemDTO[]; // response payload

        if (folderIds.length === 0) {
          itemsOut = dto;
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
                    query.includeTrash
                      ? sql`TRUE`
                      : isNull(storageSchema.item.purgeAt)
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
                    eq(
                      storageSchema.itemEffectiveAccess.id,
                      storageSchema.item.id
                    ),
                    eq(
                      storageSchema.itemEffectiveAccess.spaceId,
                      storageSchema.item.spaceId
                    ),
                    lte(storageSchema.itemEffectiveAccess.effectiveRank, 1000)
                  )
                )
                .where(
                  and(
                    eq(storageSchema.item.spaceId, ctx.spaceId),
                    inArray(storageSchema.item.parentId, folderIds),
                    query.includeTrash
                      ? sql`TRUE`
                      : isNull(storageSchema.item.purgeAt)
                  )
                )
                .groupBy(storageSchema.item.parentId);
            }
          })();

          const countsMap = new Map<string, number>();
          for (const row of childCountRows as Array<{
            parentId: string | null;
            count: number;
          }>) {
            if (row.parentId) countsMap.set(row.parentId, Number(row.count));
          }

          itemsOut = dto.map((it) =>
            it.itemType === "folder"
              ? ({
                  ...it,
                  childCount: countsMap.get(it.id) ?? 0,
                } as typeof it & {
                  childCount: number;
                })
              : it
          );
        }

        // Compute ancestors of the current folder
        const guard = params.spaceId
          ? sql`AND space_id = ${params.spaceId}`
          : sql``;
        const ancestorsRes = await db.execute(sql`
          WITH RECURSIVE parents AS (
            SELECT *
            FROM   ${storageSchema.item} AS i
            WHERE  i.id = ${query.folderId}
              ${guard}

            UNION ALL

            SELECT p.*
            FROM   ${storageSchema.item} AS p
            JOIN   parents c ON c.parent_id = p.id
          )
          SELECT *
          FROM   parents
          ORDER  BY created_at ASC;
        `);
        const ancestors = ancestorsRes.rows;

        // Attach previewUrl for file items when a preview blob exists
        try {
          const fileItems = itemsOut.filter(
            (it) => it.itemType === "file" && it.assetId
          );
          if (fileItems.length > 0) {
            const itemIds = fileItems.map((it) => it.id);

            // Fetch latest preview objectKey per item from our S3 bucket/provider
            const previews = await db
              .select({
                itemId: storageSchema.fileBlobLocation.itemId,
                objectKey: storageSchema.fileBlobLocation.objectKey,
                updatedAt: storageSchema.fileBlobLocation.updatedAt,
              })
              .from(storageSchema.fileBlobLocation)
              .where(
                and(
                  // kind = 'preview'
                  eq(storageSchema.fileBlobLocation.kind, "preview"),
                  inArray(storageSchema.fileBlobLocation.itemId, itemIds),
                  eq(storageSchema.fileBlobLocation.provider, "aws_s3"),
                  eq(
                    storageSchema.fileBlobLocation.bucket,
                    s3Bucket.toLowerCase()
                  )
                )
              )
              .orderBy(desc(storageSchema.fileBlobLocation.updatedAt));

            // Pick most recent preview per item
            const keyByItem = new Map<string, string>();
            for (const p of previews as Array<{
              itemId: string | null;
              objectKey: string;
              updatedAt: Date | string | null;
            }>) {
              if (p.itemId && !keyByItem.has(p.itemId)) {
                keyByItem.set(p.itemId, p.objectKey);
              }
            }

            // Presign URLs
            const presignedByItem = new Map<string, string>();
            const entries = Array.from(keyByItem.entries());
            if (entries.length > 0) {
              const urls = await Promise.all(
                entries.map(async ([itemId, key]) => {
                  try {
                    const cmd = new GetObjectCommand({
                      Bucket: s3Bucket,
                      Key: key,
                    });
                    const url = await getSignedUrl(s3, cmd, {
                      expiresIn,
                    });
                    return [itemId, url] as const;
                  } catch {
                    return [itemId, null] as const;
                  }
                })
              );
              for (const [itemId, url] of urls) {
                if (url) presignedByItem.set(itemId, url);
              }
            }

            // Merge into response
            itemsOut = itemsOut.map((it) =>
              it.itemType === "file"
                ? {
                    ...it,
                    previewUrl: presignedByItem.get(it.id) ?? null,
                  }
                : it
            );
          }
        } catch (e) {
          // Non-fatal: if presigning fails, continue without previewUrl
        }

        return {
          success: true,
          data: {
            items: itemsOut,
            ancestors,
            ancestorsCount: ancestorsRes.rowCount,
          },
        };
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
        searchString: t.Optional(
          t.String({
            minLength: citextConfig.minLength,
            maxLength: citextConfig.maxLength,
          })
        ),
        match: t.Optional(t.Enum(MatchType)),
      }),
      params: t.Object({
        spaceId: t.String({ format: "uuid" }),
      }),
    }
  )
  .post(
    "/spaces/:spaceId/hard-delete-batch-items",
    async ({ body, params, set, user }) => {
      const { itemIds } = body;
      const { spaceId } = params;

      if (!spaceId || !Array.isArray(itemIds) || itemIds.length === 0) {
        set.status = 400;
        return {
          error: "spaceId (in query) and non-empty itemIds are required",
        };
      }

      const ctx = await loadAccessContext(db, user?.id ?? null, spaceId);
      if (!ctx.isOwner) {
        set.status = 403;
        return {
          error: "You do not have permission to delete files in this space.",
        };
      }

      const rawItems = await db
        .select({
          id: item.id,
          spaceId: item.spaceId,
          itemType: item.itemType,
        })
        .from(item)
        .where(
          and(
            inArray(item.id, itemIds),
            eq(item.spaceId, spaceId),
            inArray(item.itemType, ["folder", "file"])
          )
        );

      const folderIds = rawItems
        .filter((i) => i.itemType === "folder")
        .map((i) => i.id);

      const fileIds = rawItems
        .filter((i) => i.itemType === "file")
        .map((i) => i.id);

      const descendantFileIds =
        folderIds.length > 0
          ? (await getDescendantItemIds(folderIds, spaceId)).map((i) => i.id)
          : [];

      const fileIdsToDelete = [...new Set([...fileIds, ...descendantFileIds])];

      const fileBlobLocation = storageSchema.fileBlobLocation;
      const blobRows = await db
        .select({
          itemId: fileBlobLocation.itemId,
          objectKey: fileBlobLocation.objectKey,
        })
        .from(fileBlobLocation)
        .where(inArray(fileBlobLocation.itemId, fileIdsToDelete));

      const keysToDelete = blobRows
        .filter((b) => b.objectKey)
        .map((b) => ({ Key: b.objectKey }));

      let s3Results: Array<{
        itemId: string | null;
        objectKey: string;
        success: boolean;
        error?: string;
      }> = [];

      if (keysToDelete.length) {
        try {
          const data = await s3.send(
            new DeleteObjectsCommand({
              Bucket: s3Bucket,
              Delete: { Objects: keysToDelete, Quiet: false },
            })
          );

          const deleted = new Set(data.Deleted?.map((d) => d.Key!));
          const errors = new Map(
            data.Errors?.map((e) => [e.Key!, e.Message!]) ?? []
          );

          s3Results = blobRows.map((b) => ({
            itemId: b.itemId,
            objectKey: b.objectKey,
            success: deleted.has(b.objectKey),
            error: errors.get(b.objectKey),
          }));
        } catch (err) {
          s3Results = blobRows.map((b) => ({
            itemId: b.itemId,
            objectKey: b.objectKey,
            success: false,
            error: (err as Error).message,
          }));
        }
      }

      const blobsByItem = blobRows
        .filter((b) => b.itemId !== null)
        .reduce(
          (acc, blob) => {
            const itemId = blob.itemId!;
            acc[itemId] ??= [];
            acc[itemId].push(blob);
            return acc;
          },
          {} as Record<string, typeof blobRows>
        );

      const imagesToDelete = fileIdsToDelete.filter((id) => {
        const itemBlobs = blobsByItem[id] || [];
        const itemS3Results = s3Results.filter((r) => r.itemId === id);
        return (
          itemBlobs.length > 0 &&
          itemS3Results.length === itemBlobs.length &&
          itemS3Results.every((r) => r.success)
        );
      });

      await db.transaction(async (tx) => {
        if (imagesToDelete.length) {
          await tx
            .delete(fileBlobLocation)
            .where(inArray(fileBlobLocation.itemId, imagesToDelete));
          await tx
            .delete(fileAsset)
            .where(inArray(fileAsset.id, imagesToDelete));
          await tx.delete(item).where(inArray(item.id, imagesToDelete));
        }

        if (folderIds.length) {
          await tx.delete(item).where(inArray(item.id, folderIds));
        }
      });

      return {
        deleted: [...imagesToDelete, ...folderIds],
        failed: s3Results.filter((r) => !r.success),
      };
    },
    {
      body: t.Object({
        itemIds: t.Array(t.String({ format: "uuid" })),
      }),
      auth: { allowPublic: false },
    }
  );
