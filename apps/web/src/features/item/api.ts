import app from '@/lib/fetch';
import type { MatchType } from '../../../../api/src/utils/queryHelper';
import type { GetAssociatedSpaceResponse } from '../space/api';

export type AncestorsQuery = {
  spaceId: string;
  itemId: string;
  parentId: string | null;
};

export type ItemsByFolderQuery = {
  spaceId: string;
  folderId: string
  sortField?: string
  dir?: 'asc' | 'desc'
  includeTrash?: boolean
  searchString?: string;
  match?: MatchType;
};

export type CreateFolderType = {
  spaceId: string,
  parentId: string | null,
  name: string
}

export async function getAncestors(query: AncestorsQuery) {
  // GET /v1/spaces/:spaceId/items/:itemId/ancestors
  const { spaceId, itemId } = query;
  // API doesn't accept additional query; only params are required
  return app.v1.spaces({ spaceId }).items({ itemId }).ancestors.get();
}

export async function getItemById(_itemId: string) {
  return null; // TODO
}

export async function getItemsByFolder(query: ItemsByFolderQuery) {
  const { spaceId, folderId, sortField, dir, includeTrash, searchString, match } = query;
  // GET /v1/spaces/:spaceId/items?folderId=...
  return app.v1.spaces({ spaceId }).items.get({
    query: compact({ folderId, sortField, dir, includeTrash, searchString, match }),
  } as any);
}

export async function createFolder(body: CreateFolderType) {
  const { spaceId, parentId, name } = body;
  // POST /v1/spaces/:spaceId/items/folders
  return app.v1.spaces({ spaceId }).items.folders.post({ parentId, name } as any);
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out as T;
}
