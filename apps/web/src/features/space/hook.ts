import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MatchType } from "../../../../api/src/utils/queryHelper";

import * as spaceApi from './api';
import { spaceKeys } from './keys';

export function useAssociatedSpace(params?: { name?: string; match?: MatchType }) {
  return useQuery({
    queryKey: spaceKeys.associated(params),
    queryFn: () => spaceApi.getAssociatedSpace(params),
    staleTime: 10 * 60_000,
  });
}

export function useIsAssociatedWithSpace(params?: { name?: string; match?: MatchType }) {
  return useQuery({
    queryKey: spaceKeys.associated({ ...params, shape: 'isAssociated' } as any), 
    queryFn: () => spaceApi.getAssociatedSpace(params),
    select: data => Boolean(data), // adapt to your API's shape
    staleTime: 10 * 60_000,
  });
}

export function useCreateSpaceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: spaceApi.createSpace,
    onSuccess: async () => {
      // refresh associated spaces and any space lists
      await qc.invalidateQueries({ queryKey: spaceKeys.all() });
    },
  });
}