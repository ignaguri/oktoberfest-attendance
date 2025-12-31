/**
 * Business logic hooks for calendar data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch personal calendar events for a festival
 */
export function usePersonalCalendar(festivalId: string) {
  return useQuery(
    QueryKeys.personalCalendar(festivalId),
    async () => {
      const response = await apiClient.calendar.personal(festivalId);
      return response.events || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes - calendar changes with attendance
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to fetch group calendar events
 */
export function useGroupCalendar(groupId: string) {
  return useQuery(
    QueryKeys.groupCalendar(groupId),
    async () => {
      const response = await apiClient.calendar.group(groupId);
      return response.events || [];
    },
    {
      enabled: !!groupId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}
