import app from "@/lib/fetch";
import type { MatchType } from "../../../../api/src/utils/queryHelper";

// Infer enum types from the shared RDB schema (type-only, no runtime import)
type SpaceInsert = typeof import("@repo/rdb/schema").storageSchema.space.$inferInsert;
export type SpaceType = SpaceInsert["type"];
export type AccessType = SpaceInsert["accessType"];

export async function getAssociatedSpace(query?: { searchString?: string; match?: MatchType }) {
  return app.space['associated-space'].get({ query: compact(query ?? {}) });
}

export async function createSpace(body: { name: string; spaceType: SpaceType; accessType: AccessType }) {
  return app.space['create-space'].post(body);
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out as T;
}