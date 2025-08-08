import type { MatchType } from "../../../../api/src/utils/queryHelper";

export const itemKeys = {
  all: () => ["items"] as const,

  ancestors: (params: { spaceId: string; itemId: string; parentId?: string }) =>
    [...itemKeys.all(), "ancestors", params] as const,

  byId: (itemId: string) => [...itemKeys.all(), "byId", itemId] as const,

  byRootFolder: (spaceId: string) => [...itemKeys.all(), "byRootFolder", spaceId] as const,

  byFolder: (params: {
    spaceId: string;
    folderId: string;
    sortField?: string;
    dir?: "asc" | "desc";
    includeTrash?: boolean;
    searchString?: string;
    match?: MatchType;
  }) => [...itemKeys.all(), "byFolder", params] as const,
};
