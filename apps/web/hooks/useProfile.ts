/**
 * Business logic hooks for user profile data and operations
 *
 * Migrated to use Hono API client instead of server actions
 */

import { uploadAvatar } from "@/components/Avatar/actions";
import { apiClient } from "@/lib/api-client";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { getUser } from "@/lib/sharedActions";

/**
 * Hook to fetch current user data
 * Note: This still uses server action as auth user comes from Supabase directly
 */
export function useCurrentUser() {
  return useQuery(QueryKeys.user(), () => getUser(), {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

/**
 * Hook to fetch current user's profile
 */
export function useCurrentProfile() {
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

/**
 * Hook to update user profile with cache invalidation
 */
export function useUpdateProfile() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (profileData: {
      username?: string;
      full_name?: string;
      custom_beer_cost?: number | null;
    }) => {
      const response = await apiClient.profile.update(profileData);
      return response.profile;
    },
    {
      onSuccess: () => {
        // Invalidate profile and user queries
        invalidateQueries(QueryKeys.profile());
        invalidateQueries(QueryKeys.user());
        // Also invalidate highlights since custom_beer_cost affects it
        invalidateQueries(["highlights"]);
      },
    },
  );
}

/**
 * Hook to delete user account
 */
export function useDeleteProfile() {
  return useMutation(async () => {
    const response = await apiClient.profile.delete();
    return response;
  });
}

/**
 * Hook to upload user avatar
 * Note: This still uses server action as file uploads need server-side processing
 */
export function useUploadAvatar() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation((formData: FormData) => uploadAvatar(formData), {
    onSuccess: () => {
      // Invalidate profile queries
      invalidateQueries(QueryKeys.profile());
    },
  });
}

/**
 * Hook to fetch tutorial status
 */
export function useTutorialStatus() {
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

/**
 * Hook to complete tutorial
 */
export function useCompleteTutorial() {
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
    },
  );
}

/**
 * Hook to reset tutorial
 */
export function useResetTutorial() {
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
    },
  );
}
