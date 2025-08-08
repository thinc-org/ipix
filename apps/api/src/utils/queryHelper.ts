import { /* sql, exists, */ PgColumn, PgSelect } from "drizzle-orm/pg-core";
import { storageSchema as s, storageSchema } from "@repo/rdb/schema";
import { User } from "better-auth";
import { createDb, DatabaseInstance } from "../drizzle/client";
import { and, eq, isNull, like, lte, or, sql } from "drizzle-orm";

const db = createDb({ databaseUrl: process.env.DATABASE_URL });

export type AccessContext = {
  userId: string | null;
  spaceId: string;
  isOwner: boolean;
};

export async function loadAccessContext(
  db: DatabaseInstance,
  userId: string | null,
  spaceId: string
): Promise<AccessContext> {
  if (!userId) {
    return { userId: null, spaceId: spaceId, isOwner: false };
  }
  const [owner] = await db
    .select()
    .from(storageSchema.space)
    .where(
      and(
        eq(storageSchema.space.id, spaceId),
        eq(storageSchema.space.ownedBy, userId)
      )
    )
    .limit(1);
  return { userId: userId, spaceId: spaceId, isOwner: !!owner };
}

export function ensureOwner(ctx: AccessContext) {
  if (!ctx.isOwner) {
    return false;
  }

  return true;
}

export async function scopeItemRead<T extends PgSelect>(
  ctx: AccessContext,
  args: {
    itemId: string;
    includeTrash?: boolean;
  }
) {
  let qb = db.select().from(storageSchema.item)
  const base = ctx.isOwner
    ? qb
    : qb.innerJoin(
        storageSchema.itemWithEffectiveAccess,
        and(
          eq(storageSchema.itemWithEffectiveAccess.id, storageSchema.item.id),
          eq(
            storageSchema.itemWithEffectiveAccess.spaceId,
            storageSchema.item.spaceId
          ),
          lte(storageSchema.itemWithEffectiveAccess.effectiveRank, 1000)
        )
      );

  return await base.where(
    and(
      eq(storageSchema.item.spaceId, ctx.spaceId),
      eq(storageSchema.item.id, args.itemId),
      args.includeTrash ? sql`TRUE` : isNull(storageSchema.item.trashedDeleteDT)
    )
  ).limit(1);
}

export function scopeItemsRead<T extends PgSelect>(
  qb: T,
  ctx: AccessContext,
  args: {
    parentId: string | null;
    includeTrash?: boolean;
    name?: string;
    match?: MatchType;
  }
) {
  const match = args.match ?? MatchType.CONTAINS
  const base = ctx.isOwner
    ? qb
    : qb.innerJoin(
        storageSchema.itemWithEffectiveAccess,
        and(
          eq(storageSchema.itemWithEffectiveAccess.id, storageSchema.item.id),
          eq(
            storageSchema.itemWithEffectiveAccess.spaceId,
            storageSchema.item.spaceId
          ),
          lte(storageSchema.itemWithEffectiveAccess.effectiveRank, 1000)
        )
      );

  return base.where(
    and(
      eq(storageSchema.item.spaceId, ctx.spaceId),
      args.parentId === null
        ? isNull(storageSchema.item.parentId)
        : eq(storageSchema.item.parentId, args.parentId),
      args.includeTrash ? sql`TRUE` : isNull(storageSchema.item.trashedDeleteDT),
      args.name ? patternBuilder(storageSchema.item.name, args.name, match) : sql`TRUE`
    )
  );
}

function withPagination<T extends PgSelect>(
  qb: T,
  page: number = 1,
  pageSize: number = 10
) {
  return qb.limit(pageSize).offset((page - 1) * pageSize);
}

export const MatchType = {
  EXACT: "exact",
  CONTAINS: "contains",
  STARTS_WITH: "startsWith",
} as const;
export type MatchType = (typeof MatchType)[keyof typeof MatchType];

export function withMatch<T extends PgSelect>(
  qb: T,
  matchColumn: PgColumn,
  matchType: MatchType,
  searchString: string
): T {
  return qb.where(patternBuilder(matchColumn, searchString, matchType))
}

function patternBuilder(matchColumn: PgColumn, searchString: string, matchType: MatchType) {
    switch (matchType) {
    case MatchType.EXACT:
      return eq(matchColumn, searchString);

    case MatchType.CONTAINS:
      return like(matchColumn, `%${searchString}%`);

    case MatchType.STARTS_WITH:
      return like(matchColumn, `${searchString}%`);

    default: {
      // Exhaustiveness guard – makes sure we handled every literal
      const _never: never = matchType;
      return sql`TRUE`;
    }
  }
}