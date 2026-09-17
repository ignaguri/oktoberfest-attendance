/**
 * Shared hooks for day plans: the user's one mark per festival day (a plan to
 * go or a reservation), and friends' visible plans.
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type {
  DayPlan,
  GetFriendsGoingResponse,
  ListDayPlansResponse,
  UpsertDayPlanInput,
} from "../schemas";

/**
 * A plan save can create, change or cancel a reservation, so every view that
 * reads reservations has to refetch too.
 */
function useInvalidateDayPlanQueries() {
  const invalidateQueries = useInvalidateQueries();

  return (festivalId: string) => {
    invalidateQueries(QueryKeys.dayPlans(festivalId));
    invalidateQueries(QueryKeys.reservations(festivalId));
    invalidateQueries(QueryKeys.personalCalendar(festivalId));
  };
}

export function useDayPlans(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.dayPlans(festivalId || ""),
    async (): Promise<ListDayPlansResponse> => {
      if (!festivalId) {
        return { plans: [] };
      }
      return apiClient.dayPlans.list(festivalId);
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  );
}

export function useUpsertDayPlan() {
  const apiClient = useApiClient();
  const invalidateDayPlanQueries = useInvalidateDayPlanQueries();

  return useMutation(
    async ({
      festivalId,
      date,
      input,
    }: {
      festivalId: string;
      date: string;
      input: UpsertDayPlanInput;
    }): Promise<DayPlan> => {
      const response = await apiClient.dayPlans.upsert(festivalId, date, input);
      return response.plan;
    },
    {
      onSuccess: (_data, variables) => {
        invalidateDayPlanQueries(variables.festivalId);
      },
    },
  );
}

export function useDeleteDayPlan() {
  const apiClient = useApiClient();
  const invalidateDayPlanQueries = useInvalidateDayPlanQueries();

  return useMutation(
    async ({ festivalId, date }: { festivalId: string; date: string }): Promise<void> => {
      await apiClient.dayPlans.remove(festivalId, date);
    },
    {
      onSuccess: (_data, variables) => {
        invalidateDayPlanQueries(variables.festivalId);
      },
    },
  );
}

export function useFriendsGoing(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendsGoing(festivalId || ""),
    async (): Promise<GetFriendsGoingResponse> => {
      if (!festivalId) {
        return { days: [] };
      }
      return apiClient.dayPlans.friendsGoing(festivalId);
    },
    {
      enabled: !!festivalId,
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  );
}
