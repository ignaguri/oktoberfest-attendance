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
    }
  );
}

/**
 * Hook to update user profile with cache invalidation
 */
export function useUpdateProfile() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (profileData: {
      username?: string;
      full_name?: string;
      preferred_language?: string | null;
    }) => {
      const response = await apiClient.profile.update(profileData);
      return response.profile;
    },
    {
      onSuccess: () => {
        // Invalidate profile and user queries
        invalidateQueries(QueryKeys.profile());
        invalidateQueries(QueryKeys.user());
        invalidateQueries(["highlights"]);
      },
    }
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
    }
  );
}

/**
 * Hook to complete tutorial
 */
export function useCompleteTutorial() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async () => {
      return await apiClient.profile.completeTutorial();
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.tutorialStatus());
        invalidateQueries(QueryKeys.profile());
      },
    }
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
    }
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
    }
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
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    }
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
    }
  );
}
