/**
 * Business logic hooks for admin panel functionality
 *
 * These hooks handle all admin-related data operations
 */

import { getGroups, getUsers } from "@/app/[lang]/(private)/admin/actions";
import { useQuery } from "@/lib/data/react-query-provider";

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
