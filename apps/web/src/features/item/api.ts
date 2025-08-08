import app from '@/lib/fetch';
import type { MatchType } from '../../../../api/src/utils/queryHelper';

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

export async function getAncestors(query: AncestorsQuery) {
  // Only send defined fields to avoid "undefined is not assignable to string"
  return app.item.ancestors.get({ query: compact(query) });
}

export async function getItemById(itemId: string) {
  return null // TODO
}

export async function getRootFolder(spaceId: string) {
  return app.item.item.get({query:{ spaceId: spaceId, searchString: spaceId, match: 'exact'} })
}

export async function getItemsByFolder(query: ItemsByFolderQuery) {
  return app.item.items.get({ query: compact(query) })
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out as T;
}
