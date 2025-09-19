/**
 * Business logic hooks for admin panel functionality
 *
 * These hooks handle all admin-related data operations
 */

import { getUsers, getGroups } from "@/app/(private)/admin/actions";
import {
  createFestival,
  updateFestival,
  deleteFestival,
} from "@/app/(private)/admin/festivalActions";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch all users (admin only)
 */
export function useAllUsers() {
  return useQuery(["admin", "users"], () => getUsers(), {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Hook to fetch all groups (admin only)
 */
export function useAllGroups() {
  return useQuery(["admin", "groups"], () => getGroups(), {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Hook to create a festival (admin only)
 */
export function useCreateFestival() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    (festivalData: Parameters<typeof createFestival>[0]) =>
      createFestival(festivalData),
    {
      onSuccess: () => {
        // Invalidate festivals queries
        invalidateQueries(QueryKeys.festivals());
        invalidateQueries(["admin", "festivals"]);
      },
    },
  );
}

/**
 * Hook to update a festival (admin only)
 */
export function useUpdateFestival() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updateFestival>[1];
    }) => updateFestival(id, updates),
    {
      onSuccess: () => {
        // Invalidate all festivals
        invalidateQueries(QueryKeys.festivals());
        invalidateQueries(["admin", "festivals"]);
      },
    },
  );
}

/**
 * Hook to delete a festival (admin only)
 */
export function useDeleteFestival() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation((id: string) => deleteFestival(id), {
    onSuccess: () => {
      // Invalidate all festivals
      invalidateQueries(QueryKeys.festivals());
      invalidateQueries(["admin", "festivals"]);
    },
  });
}
