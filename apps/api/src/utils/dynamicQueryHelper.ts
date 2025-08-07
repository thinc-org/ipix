import { User } from "better-auth";
import { eq, like } from "drizzle-orm";
import { PgColumn, type PgSelect } from "drizzle-orm/pg-core";

function withPagination<T extends PgSelect>(
  qb: T,
  page: number = 1,
  pageSize: number = 10
) {
  return qb.limit(pageSize).offset((page - 1) * pageSize);
}

function withAuth<T extends PgSelect>(
  qb: T,
  userColumn: PgColumn,
  userInfo: User
) {
  return qb.where(eq(userColumn, userInfo.id));
}

export const MatchType = {
  EXACT: 'exact',
  CONTAINS: 'contains',
  STARTS_WITH: 'startsWith',
} as const;
export type MatchType = typeof MatchType[keyof typeof MatchType];

export function withMatch<T extends PgSelect>(
  qb: T,
  matchColumn: PgColumn,
  matchType: MatchType,
  searchString: string,
): T {
  switch (matchType) {
    case MatchType.EXACT:
      return qb.where(eq(matchColumn, searchString));

    case MatchType.CONTAINS:
      return qb.where(like(matchColumn, `%${searchString}%`));

    case MatchType.STARTS_WITH:
      return qb.where(like(matchColumn, `${searchString}%`));

    default: {
      // Exhaustiveness guard – makes sure we handled every literal
      const _never: never = matchType;
      return qb;
    }
  }
}
