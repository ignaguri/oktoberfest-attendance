/**
 * Shared hooks for notification preferences
 *
 * Uses ApiClientContext to get the platform-specific API client.
 * Works on both web and mobile apps.
 */

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  useSetQueryData,
  useGetQueryData,
  useCancelQueries,
  QueryKeys,
} from "../data";

/**
 * Response type from the notification preferences API
 */
export type NotificationPreferencesResponse = {
  userId: string;
  pushEnabled: boolean | null;
  groupJoinEnabled: boolean | null;
  checkinEnabled: boolean | null;
  remindersEnabled: boolean | null;
  achievementNotificationsEnabled: boolean | null;
  groupNotificationsEnabled: boolean | null;
  createdAt: string;
  updatedAt: string | null;
} | null;

/**
 * Input type for updating notification preferences
 */
export type UpdateNotificationPreferencesInput = {
  pushEnabled?: boolean;
  groupJoinEnabled?: boolean;
  checkinEnabled?: boolean;
  remindersEnabled?: boolean;
  achievementNotificationsEnabled?: boolean;
  groupNotificationsEnabled?: boolean;
};

/**
 * Hook to fetch user notification preferences
 */
export function useNotificationPreferences(userId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.notificationPreferences(userId || "current"),
    async () => {
      const response = await apiClient.notifications.getPreferences();
      return response;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
      enabled: true, // Always fetch when user is authenticated
    },
  );
}

/**
 * Hook to update notification preferences with optimistic updates
 */
export function useUpdateNotificationPreferences(userId?: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();
  const setQueryData = useSetQueryData();
  const getQueryData = useGetQueryData();
  const cancelQueries = useCancelQueries();

  const queryKey = QueryKeys.notificationPreferences(userId || "current");

  return useMutation<
    { success: boolean },
    UpdateNotificationPreferencesInput,
    { previousPreferences: NotificationPreferencesResponse | undefined }
  >(
    async (data) => {
      return await apiClient.notifications.updatePreferences(data);
    },
    {
      onMutate: async (newData) => {
        // Cancel any outgoing refetches
        await cancelQueries(queryKey);

        // Snapshot the previous value
        const previousPreferences =
          getQueryData<NotificationPreferencesResponse>(queryKey);

        // Optimistically update the cache
        if (previousPreferences) {
          setQueryData<NotificationPreferencesResponse>(queryKey, {
            ...previousPreferences,
            ...(newData.pushEnabled !== undefined && {
              pushEnabled: newData.pushEnabled,
            }),
            ...(newData.groupJoinEnabled !== undefined && {
              groupJoinEnabled: newData.groupJoinEnabled,
            }),
            ...(newData.checkinEnabled !== undefined && {
              checkinEnabled: newData.checkinEnabled,
            }),
            ...(newData.remindersEnabled !== undefined && {
              remindersEnabled: newData.remindersEnabled,
            }),
            ...(newData.achievementNotificationsEnabled !== undefined && {
              achievementNotificationsEnabled:
                newData.achievementNotificationsEnabled,
            }),
            ...(newData.groupNotificationsEnabled !== undefined && {
              groupNotificationsEnabled: newData.groupNotificationsEnabled,
            }),
            updatedAt: new Date().toISOString(),
          });
        }

        return { previousPreferences };
      },
      onError: (_error, _variables, context) => {
        // Rollback on error
        if (context?.previousPreferences) {
          setQueryData<NotificationPreferencesResponse>(
            queryKey,
            context.previousPreferences,
          );
        }
      },
      onSettled: () => {
        // Always refetch after error or success to ensure cache is in sync
        invalidateQueries(queryKey);
      },
    },
  );
}

/**
 * Hook to register FCM token with Novu
 */
export function useRegisterFCMToken() {
  const apiClient = useApiClient();

  return useMutation(async (token: string) => {
    return await apiClient.notifications.registerToken(token);
  });
}

/**
 * Hook to subscribe user to Novu notifications
 */
export function useSubscribeToNotifications() {
  const apiClient = useApiClient();

  return useMutation(
    async (data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    }) => {
      return await apiClient.notifications.subscribe(data);
    },
  );
}
