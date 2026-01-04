/**
 * Business logic hooks for reservation data and operations
 */

import { apiClient } from "@/lib/api-client";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch a single reservation by ID
 */
export function useReservation(reservationId: string | null) {
  return useQuery(
    QueryKeys.reservation(reservationId || ""),
    async () => {
      if (!reservationId) return null;
      const { reservation } = await apiClient.reservations.get(reservationId);
      return reservation;
    },
    {
      enabled: !!reservationId,
      staleTime: 1 * 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to fetch user's reservations
 */
export function useReservations(festivalId?: string) {
  return useQuery(
    QueryKeys.reservations(festivalId || ""),
    async () => {
      if (!festivalId) return { reservations: [], total: 0 };
      const response = await apiClient.reservations.list({ festivalId });
      return response;
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to create a new reservation
 */
export function useCreateReservation() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (data: {
      festivalId: string;
      tentId: string;
      startAt: string;
      endAt?: string;
      note?: string;
      visibleToGroups?: boolean;
      autoCheckin?: boolean;
      reminderOffsetMinutes?: number;
    }) => {
      const response = await apiClient.reservations.create(data);
      return response.reservation;
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate reservations list
        invalidateQueries(QueryKeys.reservations(variables.festivalId));
        // Invalidate calendar queries
        invalidateQueries(QueryKeys.personalCalendar(variables.festivalId));
      },
    },
  );
}

/**
 * Hook to update an existing reservation
 */
export function useUpdateReservation() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      reservationId,
      data,
    }: {
      reservationId: string;
      data: {
        startAt?: string;
        endAt?: string | null;
        note?: string | null;
        visibleToGroups?: boolean;
        autoCheckin?: boolean;
        reminderOffsetMinutes?: number;
      };
    }) => {
      const response = await apiClient.reservations.update(reservationId, data);
      return response.reservation;
    },
    {
      onSuccess: (data) => {
        // Invalidate specific reservation
        invalidateQueries(QueryKeys.reservation(data.id));
        // Invalidate reservations list
        invalidateQueries(QueryKeys.reservations(data.festivalId));
        // Invalidate calendar queries
        invalidateQueries(QueryKeys.personalCalendar(data.festivalId));
      },
    },
  );
}

/**
 * Hook to cancel a reservation
 */
export function useCancelReservation() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      reservationId,
      festivalId,
    }: {
      reservationId: string;
      festivalId: string;
    }) => {
      const response = await apiClient.reservations.cancel(reservationId);
      return { ...response.reservation, festivalId };
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate specific reservation
        invalidateQueries(QueryKeys.reservation(variables.reservationId));
        // Invalidate reservations list
        invalidateQueries(QueryKeys.reservations(variables.festivalId));
        // Invalidate calendar queries
        invalidateQueries(QueryKeys.personalCalendar(variables.festivalId));
      },
    },
  );
}

/**
 * Hook to check in to a reservation
 */
export function useCheckInReservation() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      reservationId,
      festivalId,
    }: {
      reservationId: string;
      festivalId: string;
    }) => {
      const response = await apiClient.reservations.checkIn(reservationId);
      return { ...response, festivalId };
    },
    {
      onSuccess: (_data, variables) => {
        // Invalidate specific reservation
        invalidateQueries(QueryKeys.reservation(variables.reservationId));
        // Invalidate reservations list
        invalidateQueries(QueryKeys.reservations(variables.festivalId));
        // Invalidate calendar and attendance queries
        invalidateQueries(QueryKeys.personalCalendar(variables.festivalId));
        invalidateQueries(QueryKeys.attendances(variables.festivalId));
      },
    },
  );
}
