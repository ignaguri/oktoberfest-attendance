/**
 * Business logic hooks for admin panel functionality
 *
 * These hooks handle all admin-related data operations
 */

import { QueryKeys } from "@prostcounter/shared/data";

import { getGroups, getUsers } from "@/app/(private)/admin/actions";
import {
  createFestival,
  deleteFestival,
  updateFestival,
} from "@/app/(private)/admin/festivalActions";
import {
  useInvalidateQueries,
  useMutation,
  useQuery,
} from "@/lib/data/react-query-provider";

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
