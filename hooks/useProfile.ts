/**
 * Business logic hooks for user profile data and operations
 *
 * These hooks handle user profile management functionality
 */

import { updateProfile } from "@/app/(private)/profile/actions";
import { uploadAvatar } from "@/components/Avatar/actions";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { getProfileShort, getUser } from "@/lib/sharedActions";

/**
 * Hook to fetch current user data
 */
export function useCurrentUser() {
  return useQuery(QueryKeys.user(), () => getUser(), {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

/**
 * Hook to fetch current user's profile
 */
export function useCurrentProfile() {
  return useQuery(QueryKeys.profile(), () => getProfileShort(), {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

/**
 * Hook to update user profile with cache invalidation
 */
export function useUpdateProfile() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    (profileData: Parameters<typeof updateProfile>[0]) =>
      updateProfile(profileData),
    {
      onSuccess: () => {
        // Invalidate profile and user queries
        invalidateQueries(QueryKeys.profile());
        invalidateQueries(QueryKeys.user());
      },
    },
  );
}

/**
 * Hook to upload user avatar
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
