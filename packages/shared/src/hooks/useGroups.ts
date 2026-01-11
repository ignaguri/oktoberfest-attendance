/**
 * Shared hooks for group-related data and operations
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  QueryKeys,
} from "../data";

/**
 * Hook to fetch user's groups for a festival
 */
export function useUserGroups(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.userGroups("current", festivalId || ""),
    async () => {
      if (!festivalId) return [];

      const { data } = await apiClient.groups.list({ festivalId });
      return data;
    },
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    }
  );
}

/**
 * Hook to fetch group settings/details
 */
export function useGroupSettings(groupId: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.group(groupId),
    async () => {
      return await apiClient.groups.get(groupId);
    },
    {
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    }
  );
}

/**
 * Hook to create a new group with cache invalidation
 */
export function useCreateGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (formData: {
      groupName: string;
      password: string;
      festivalId: string;
      winningCriteria?: "days_attended" | "total_beers" | "avg_beers";
    }) => {
      // Transform old schema to new API schema
      const response = await apiClient.groups.create({
        name: formData.groupName,
        festivalId: formData.festivalId,
        winningCriteria: formData.winningCriteria || "total_beers",
      });

      return response.data.id; // Return just the ID to match old behavior
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate user groups for the specific festival
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate groups for the specific festival
        if (variables.festivalId) {
          invalidateQueries(["groups", variables.festivalId]);
        }
        // Also invalidate general user and groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    }
  );
}

/**
 * Hook to search for groups by name
 * Use this to find groups before joining
 */
export function useGroupSearch(name: string, festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupSearch(name, festivalId || ""),
    async () => {
      if (!name || name.length < 2) return [];

      const { data } = await apiClient.groups.search({
        name,
        festivalId,
        limit: 10,
      });
      return data;
    },
    {
      enabled: name.length >= 2,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 60 * 1000, // 1 minute cache
    }
  );
}

/**
 * Hook to join a group by invite token
 */
export function useJoinGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (formData: { groupId: string; inviteToken?: string }) => {
      const { groupId, inviteToken } = formData;
      return await apiClient.groups.join(groupId, inviteToken);
    },
    {
      onSuccess: () => {
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    }
  );
}

/**
 * Hook to join a group using only an invite token
 * Used for deep links and direct token entry
 */
export function useJoinGroupByToken() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (inviteToken: string) => {
      return await apiClient.groups.joinByToken(inviteToken);
    },
    {
      onSuccess: () => {
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    }
  );
}

/**
 * Hook to update group settings
 */
export function useUpdateGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      groupId,
      updates,
    }: {
      groupId: string;
      updates: {
        name?: string;
        winningCriteriaId?: number;
        description?: string | null;
      };
    }) => {
      return await apiClient.groups.update(groupId, updates);
    },
    {
      onSuccess: (_data, { groupId }) => {
        // Invalidate specific group
        invalidateQueries(["group", groupId]);
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups and user queries as fallback
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    }
  );
}

/**
 * Hook to leave a group
 */
export function useLeaveGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ groupId }: { groupId: string; userId: string }) => {
      return await apiClient.groups.leave(groupId);
    },
    {
      onSuccess: (_data, { groupId }) => {
        // Invalidate specific group and its members
        invalidateQueries(["group", groupId]);
        invalidateQueries(["group", groupId, "members"]);
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups and user queries as fallback
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    }
  );
}

/**
 * Hook to fetch just the group name (lightweight version of useGroupSettings)
 * Useful for breadcrumbs and other components that only need the group name
 */
export function useGroupName(groupId: string) {
  const apiClient = useApiClient();

  return useQuery(
    ["group", groupId, "name"] as const, // Unique key to avoid collision with full group data
    async () => {
      try {
        const response = await apiClient.groups.get(groupId);
        return response.data.name || "Unknown Group";
      } catch {
        return "Unknown Group";
      }
    },
    {
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000, // 10 minutes (same as group settings)
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    }
  );
}

/**
 * Hook to fetch group members
 */
export function useGroupMembers(groupId: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupMembers(groupId),
    async () => {
      const response = await apiClient.groups.getMembers(groupId);
      return response.data;
    },
    {
      enabled: !!groupId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    }
  );
}

/**
 * Hook to remove a member from a group
 */
export function useRemoveMember() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ groupId, userId }: { groupId: string; userId: string }) => {
      return await apiClient.groups.removeMember(groupId, userId);
    },
    {
      onSuccess: (_data, { groupId }) => {
        // Invalidate group members
        invalidateQueries(QueryKeys.groupMembers(groupId));
        // Invalidate group details
        invalidateQueries(QueryKeys.group(groupId));
        // Invalidate leaderboards that might be affected
        invalidateQueries(["leaderboard"]);
      },
    }
  );
}

/**
 * Hook to regenerate group invite token
 */
export function useRenewInviteToken() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ groupId }: { groupId: string }) => {
      return await apiClient.groups.renewToken(groupId);
    },
    {
      onSuccess: (_data, { groupId }) => {
        // Invalidate group details to refresh the invite token
        invalidateQueries(QueryKeys.group(groupId));
      },
    }
  );
}

/**
 * Hook to fetch group gallery photos
 */
export function useGroupGallery(groupId: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupGallery(groupId),
    async () => {
      const response = await apiClient.groups.getGallery(groupId);
      return response.data;
    },
    {
      enabled: !!groupId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    }
  );
}
