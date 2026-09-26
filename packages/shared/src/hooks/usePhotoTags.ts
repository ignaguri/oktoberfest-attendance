/**
 * Photo tags: who is in a photo, and the photos a person is tagged in.
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type { GetTaggedPhotosResponse, PhotoTagsResponse } from "../schemas";

export function usePhotoTags(photoId: string | null) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.photoTags(photoId || ""),
    async (): Promise<PhotoTagsResponse> => apiClient.photoTags.get(photoId as string),
    {
      enabled: !!photoId,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );
}

export function useSetPhotoTags() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ photoId, userIds }: { photoId: string; userIds: string[]; groupId?: string }) => {
      return await apiClient.photoTags.set(photoId, userIds);
    },
    {
      onSuccess: (_data, { photoId, groupId }) => {
        invalidateQueries(QueryKeys.photoTags(photoId));
        invalidateQueries(["tagged-photos"]);
        if (groupId) {
          invalidateQueries(QueryKeys.groupGallery(groupId));
        }
      },
    },
  );
}

export function useTaggedPhotos(userId: string | undefined, festivalId: string | undefined) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.taggedPhotos(userId || "", festivalId || ""),
    async (): Promise<GetTaggedPhotosResponse> =>
      apiClient.photoTags.listTaggedPhotos(userId as string, festivalId as string),
    {
      enabled: !!userId && !!festivalId,
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  );
}
