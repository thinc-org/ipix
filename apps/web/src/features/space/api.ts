import app from "@/lib/fetch";
import type { MatchType } from "../../../../api/src/utils/queryHelper";

// Infer enum types from the shared RDB schema (type-only, no runtime import)
type SpaceInsert = typeof import("@repo/rdb/schema").storageSchema.space.$inferInsert;
type SpaceSelect = typeof import("@repo/rdb/schema").storageSchema.space.$inferSelect;
type ItemSelect = typeof import("@repo/rdb/schema").storageSchema.item.$inferSelect;
export type OwnershipType = SpaceInsert["ownershipType"];
type RequiredOwnershipType = NonNullable<OwnershipType>;

export type GetAssociatedSpaceResponse = {
  success: boolean;
  data: { mySpace: SpaceSelect[] };
};

export async function getAssociatedSpace(query?: { searchString?: string; match?: MatchType }): Promise<GetAssociatedSpaceResponse> {
  const res = await app.space['associated-space'].get({ query: compact(query ?? {}) });
  if ((res as any).error) throw (res as any).error;
  return (res as any).data as GetAssociatedSpaceResponse;
}

export type CreateSpaceResponse = {
  success: boolean;
  data: { newSpace: SpaceSelect; rootFolder: ItemSelect };
};

export async function createSpace(body: { name: string; ownershipType: RequiredOwnershipType }): Promise<CreateSpaceResponse> {
  const res = await app.space['create-space'].post(body);
  if ((res as any).error) throw (res as any).error;
  return (res as any).data as CreateSpaceResponse;
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out as T;
}