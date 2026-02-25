/**
 * Shared hooks for photo reactions and comments (group-scoped)
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  QueryKeys,
} from "../data";

/**
 * Hook to fetch reactions for a photo in a group
 */
export function usePhotoReactions(photoId: string, groupId: string) {
  const apiClient = useApiClient();

  const enabled = !!photoId && !!groupId;

  return useQuery(
    QueryKeys.photoReactions(photoId, groupId),
    async () => {
      return await apiClient.photoSocial.getReactions(photoId, groupId);
    },
    {
      enabled,
      staleTime: 30 * 1000, // 30 seconds - reactions change frequently
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to add a reaction to a photo
 */
export function useAddReaction() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      photoId,
      groupId,
      emoji,
    }: {
      photoId: string;
      groupId: string;
      emoji: string;
    }) => {
      return await apiClient.photoSocial.addReaction(photoId, groupId, emoji);
    },
    {
      onSuccess: (_data, { photoId, groupId }) => {
        invalidateQueries(QueryKeys.photoReactions(photoId, groupId));
      },
    },
  );
}

/**
 * Hook to remove a reaction from a photo
 */
export function useRemoveReaction() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      photoId,
      groupId,
      emoji,
    }: {
      photoId: string;
      groupId: string;
      emoji: string;
    }) => {
      return await apiClient.photoSocial.removeReaction(photoId, groupId, emoji);
    },
    {
      onSuccess: (_data, { photoId, groupId }) => {
        invalidateQueries(QueryKeys.photoReactions(photoId, groupId));
      },
    },
  );
}

/**
 * Hook to fetch comments for a photo in a group
 */
export function usePhotoComments(photoId: string, groupId: string) {
  const apiClient = useApiClient();

  const enabled = !!photoId && !!groupId;

  return useQuery(
    QueryKeys.photoComments(photoId, groupId),
    async () => {
      const response = await apiClient.photoSocial.getComments(photoId, groupId);
      return response.comments;
    },
    {
      enabled,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to add a comment to a photo
 */
export function useAddComment() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      photoId,
      groupId,
      content,
    }: {
      photoId: string;
      groupId: string;
      content: string;
    }) => {
      return await apiClient.photoSocial.addComment(photoId, groupId, content);
    },
    {
      onSuccess: (_data, { photoId, groupId }) => {
        invalidateQueries(QueryKeys.photoComments(photoId, groupId));
      },
    },
  );
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      photoId,
      commentId,
      groupId,
    }: {
      photoId: string;
      commentId: string;
      groupId: string;
    }) => {
      return await apiClient.photoSocial.deleteComment(photoId, commentId);
    },
    {
      onSuccess: (_data, { photoId, groupId }) => {
        invalidateQueries(QueryKeys.photoComments(photoId, groupId));
      },
    },
  );
}
