/**
 * Profile hooks - partial re-exports from shared package + web-specific hooks
 *
 * These hooks use the ApiClientContext to access the API client.
 * The ApiClientProvider is set up in lib/data/query-client.tsx
 *
 * Web-specific hooks (useCurrentUser, useUploadAvatar) are defined here
 * because they depend on server actions or web-specific file handling.
 */

import { QueryKeys } from "@prostcounter/shared/data";

import { uploadAvatar } from "@/components/Avatar/actions";
import {
  useInvalidateQueries,
  useMutation,
  useQuery,
} from "@/lib/data/react-query-provider";
import { getUser } from "@/lib/sharedActions";

// Re-export shared profile hooks
export {
  useCompleteTutorial,
  useCurrentProfile,
  useDeleteProfile,
  useHighlights,
  useMissingProfileFields,
  useResetTutorial,
  useTutorialStatus,
  useUpdateProfile,
} from "@prostcounter/shared/hooks";

/**
 * Hook to fetch current user data (web-specific)
 * Note: This uses server action as auth user comes from Supabase directly
 */
export function useCurrentUser() {
  return useQuery(QueryKeys.user(), () => getUser(), {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

/**
 * Hook to upload user avatar (web-specific)
 * Note: This uses server action as file uploads need server-side processing
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
