import type { MatchType } from "../../../../api/src/utils/queryHelper";

export const spaceKeys = {
  all: () => ["spaces"] as const,

  associated: (params?: { searchString?: string; match?: MatchType }) =>
    [...spaceKeys.all(), "associated", params ?? {}] as const,
};