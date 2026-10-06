/**
 * Friends and group-mates who logged a festival day so far.
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { QueryKeys, useApiClient, useQuery } from "../data";
import type { GetFriendsWentResponse } from "../schemas";

export function useFriendsWent(
  festivalId?: string,
  date?: string,
  options?: { enabled?: boolean; staleTime?: number },
) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendsWent(festivalId || "", date || ""),
    async (): Promise<GetFriendsWentResponse> => {
      if (!festivalId || !date) {
        return { friends: [] };
      }
      return apiClient.attendance.friendsWent(festivalId, date);
    },
    {
      enabled: !!festivalId && !!date && options?.enabled !== false,
      staleTime: options?.staleTime ?? 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  );
}
