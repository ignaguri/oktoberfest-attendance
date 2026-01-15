/**
 * Shared hooks for user profile data and operations
 *
 * Uses ApiClientContext to get the platform-specific API client
 *
 * Note: Some profile hooks (useCurrentUser, useUploadAvatar) remain platform-specific
 * because they depend on platform-specific features (server actions, file uploads)
 */

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  useSetQueryData,
  useGetQueryData,
  useCancelQueries,
  QueryKeys,
} from "../data";

/**
 * Hook to fetch current user's profile
 */
export function useCurrentProfile() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.profile(),
    async () => {
      const response = await apiClient.profile.get();
      return response.profile;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}

// Type for profile cache data
type ProfileCacheData = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  tutorial_completed: boolean | null;
  tutorial_completed_at: string | null;
  updated_at: string | null;
};

/**
 * Hook to update user profile with optimistic updates
 */
export function useUpdateProfile() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  const setQueryData = useSetQueryData();
  const getQueryData = useGetQueryData();
  const cancelQueries = useCancelQueries();

  return useMutation<
    ProfileCacheData,
    {
      username?: string;
      full_name?: string;
      preferred_language?: string | null;
    },
    { previousProfile: ProfileCacheData | undefined }
  >(
    async (profileData) => {
      const response = await apiClient.profile.update(profileData);
      return response.profile;
    },
    {
      onMutate: async (newData) => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await cancelQueries(QueryKeys.profile());

        // Snapshot the previous value
        const previousProfile = getQueryData<ProfileCacheData>(
          QueryKeys.profile(),
        );

        // Optimistically update the cache with new values
        if (previousProfile) {
          setQueryData<ProfileCacheData>(QueryKeys.profile(), {
            ...previousProfile,
            ...(newData.username !== undefined && {
              username: newData.username,
            }),
            ...(newData.full_name !== undefined && {
              full_name: newData.full_name,
            }),
          });
        }

        // Return context with the previous value for rollback
        return { previousProfile };
      },
      onError: (_error, _variables, context) => {
        // Rollback to previous value on error
        if (context?.previousProfile) {
          setQueryData<ProfileCacheData>(
            QueryKeys.profile(),
            context.previousProfile,
          );
        }
      },
      onSettled: () => {
        // Always refetch after error or success to ensure cache is in sync
        invalidateQueries(QueryKeys.profile());
        invalidateQueries(QueryKeys.user());
        invalidateQueries(["highlights"]);
        // Invalidate activity feed (profile changes appear in feed)
        invalidateQueries(["activity-feed"]);
      },
    },
  );
}

/**
 * Hook to delete user account
 */
export function useDeleteProfile() {
  const apiClient = useApiClient();

  return useMutation(async () => {
    const response = await apiClient.profile.delete();
    return response;
  });
}

/**
 * Hook to fetch tutorial status
 */
export function useTutorialStatus() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.tutorialStatus(),
    async () => {
      const response = await apiClient.profile.getTutorialStatus();
      return response.status;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}

// Type for tutorial status cache data
type TutorialStatusCacheData = {
  tutorial_completed: boolean;
  tutorial_completed_at: string | null;
};

/**
 * Hook to complete tutorial
 * Uses optimistic updates to prevent tutorial from reappearing on navigation
 */
export function useCompleteTutorial() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  const setQueryData = useSetQueryData();
  const getQueryData = useGetQueryData();
  const cancelQueries = useCancelQueries();

  return useMutation<
    { success: boolean },
    void,
    { previousStatus: TutorialStatusCacheData | undefined }
  >(
    async () => {
      return await apiClient.profile.completeTutorial();
    },
    {
      onMutate: async () => {
        // Cancel any outgoing refetches
        await cancelQueries(QueryKeys.tutorialStatus());

        // Snapshot the previous value
        const previousStatus = getQueryData<TutorialStatusCacheData>(
          QueryKeys.tutorialStatus(),
        );

        // Optimistically update to completed
        setQueryData<TutorialStatusCacheData>(QueryKeys.tutorialStatus(), {
          tutorial_completed: true,
          tutorial_completed_at: new Date().toISOString(),
        });

        return { previousStatus };
      },
      onError: (_error, _variables, context) => {
        // Rollback on error
        if (context?.previousStatus) {
          setQueryData<TutorialStatusCacheData>(
            QueryKeys.tutorialStatus(),
            context.previousStatus,
          );
        }
      },
      onSettled: () => {
        invalidateQueries(QueryKeys.tutorialStatus());
        invalidateQueries(QueryKeys.profile());
      },
    },
  );
}

/**
 * Hook to reset tutorial
 */
export function useResetTutorial() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async () => {
      return await apiClient.profile.resetTutorial();
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.tutorialStatus());
        invalidateQueries(QueryKeys.profile());
      },
    },
  );
}

/**
 * Hook to fetch missing profile fields
 */
export function useMissingProfileFields() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.missingProfileFields(),
    async () => {
      const response = await apiClient.profile.getMissingFields();
      return response;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}

/**
 * Hook to fetch user highlights/stats for a festival
 */
export function useHighlights(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.highlights(festivalId || ""),
    async () => {
      if (!festivalId) return null;
      const response = await apiClient.profile.getHighlights(festivalId);
      return response.highlights;
    },
    {
      enabled: !!festivalId,
      staleTime: 1 * 60 * 1000, // 1 minute - user highlights change during festival
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch public profile of any user (for viewing other users)
 * Includes festival stats when festivalId is provided
 */
export function usePublicProfile(userId?: string, festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.publicProfile(userId || "", festivalId),
    async () => {
      if (!userId) return null;
      const response = await apiClient.profile.getPublicProfile(
        userId,
        festivalId,
      );
      return response.profile;
    },
    {
      enabled: !!userId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}
