import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import * as itemApi from "./api";
import { itemKeys } from "./keys";

export function useAncestors(params: {
  spaceId?: string;
  itemId?: string;
  parentId?: string;
}) {
  const { spaceId, itemId, parentId } = params;
  const enabled = Boolean(spaceId && itemId);
  return useQuery({
    queryKey: enabled
      ? itemKeys.ancestors({ spaceId: spaceId!, itemId: itemId!, parentId })
      : ["disabled"],
    queryFn: () =>
      itemApi.getAncestors({
        spaceId: spaceId!,
        itemId: itemId!,
        parentId: parentId ?? null,
      }),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useItemById(itemId?: string) {
  return useQuery({
    queryKey: itemId ? itemKeys.byId(itemId) : ["disabled"],
    queryFn: () => itemApi.getItemById(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60_000,
  });
}

export function useRootFolder(spaceId?: string) {
  return useQuery({
    queryKey: spaceId? itemKeys.byRootFolder(spaceId) : ["disabled"],
    queryFn: () => itemApi.getRootFolder(spaceId!),
    enabled: !!spaceId,
    staleTime: 5 * 60_000
  })
}

// Accept undefined IDs at the hook boundary so callers can pass through
// potentially undefined values and rely on `enabled` to guard execution.
type ItemsByFolderParams = Omit<itemApi.ItemsByFolderQuery, "spaceId" | "folderId"> & {
  spaceId?: string;
  folderId?: string;
};

export function useItemsByFolder(params: ItemsByFolderParams) {
  const {
    spaceId,
    folderId,
    sortField,
    dir,
    includeTrash,
    searchString,
    match,
  } = params;
  const enabled = Boolean(spaceId && folderId);
  return useQuery({
    queryKey: enabled
      ? itemKeys.byFolder({
          spaceId: spaceId!,
          folderId: folderId!,
          sortField,
          dir: dir!,
          searchString,
          match,
        })
      : ["disabled"],
    queryFn: () =>
      itemApi.getItemsByFolder({
        spaceId: spaceId!,
        folderId: folderId!,
        sortField: sortField ?? undefined,
        dir: dir ?? undefined,
        includeTrash: includeTrash ?? false,
        searchString,
        match,
      }),
    enabled,
    placeholderData: keepPreviousData, // smoother pagination/filtering
    staleTime: 60_000,
  });
}
