/**
 * Public links to Wrapped share cards. A link exists only after "Copy link";
 * sharing an image never creates one.
 */

import {
  QueryKeys,
  useApiClient,
  useInvalidateQueries,
  useMutation,
  useQuery,
} from "../data";
import type {
  CreateWrappedShareLinkBody,
  ListWrappedShareLinksResponse,
  ShareLang,
  WrappedShareLink,
} from "../schemas/wrapped-share.schema";

export function useWrappedShareLinks(
  festivalId: string | undefined,
  lang: ShareLang,
) {
  const apiClient = useApiClient();
  return useQuery(
    QueryKeys.wrappedShareLinks(festivalId ?? "", lang),
    async (): Promise<ListWrappedShareLinksResponse> =>
      apiClient.wrapped.shareLinks.list(festivalId!, lang),
    { enabled: !!festivalId },
  );
}

export function useCreateWrappedShareLink(festivalId: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  return useMutation(
    async (body: CreateWrappedShareLinkBody): Promise<WrappedShareLink> =>
      apiClient.wrapped.shareLinks.create(festivalId, body),
    {
      onSuccess: () => {
        invalidateQueries(["wrapped-share-links", festivalId]);
      },
    },
  );
}

export function useRevokeWrappedShareLink(festivalId: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  return useMutation(
    async (token: string) => apiClient.wrapped.shareLinks.revoke(token),
    {
      onSuccess: () => {
        invalidateQueries(["wrapped-share-links", festivalId]);
      },
    },
  );
}
