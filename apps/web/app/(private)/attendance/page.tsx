"use client";

import { CheckInPromptDialog } from "@/components/reservations/CheckInPromptDialog";
import { useFestival } from "@/contexts/FestivalContext";
import { useReservation, useCheckInReservation } from "@/hooks/useReservations";
import { useAttendances } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";
import { useSearchParams } from "next/navigation";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { toast } from "sonner";

import type { AttendanceWithTotals } from "@prostcounter/shared/schemas";

import DetailedAttendanceForm from "./DetailedAttendanceForm";
import PersonalAttendanceTable from "./PersonalAttendanceTable";

// Re-export API type for component use
export type AttendanceWithTentVisits = AttendanceWithTotals;

export default function AttendancePage() {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    data: attendances,
    loading: attendancesLoading,
    error: attendancesError,
    refetch: refetchAttendances,
  } = useAttendances(currentFestival?.id || "");

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const searchParams = useSearchParams();

  // Get reservation ID from URL for check-in prompt
  const reservationId = searchParams.get("reservationId");
  const prompt = searchParams.get("prompt");
  const shouldShowCheckIn = prompt === "checkin" && !!reservationId;

  // Use React Query hook for reservation data
  const { data: reservationData, error: reservationError } = useReservation(
    shouldShowCheckIn ? reservationId : null,
  );

  // Use mutation hook for check-in
  const { mutateAsync: checkIn } = useCheckInReservation();

  // Extract festivalId for check-in mutation (separate from transformed reservation)
  const reservationFestivalId = reservationData?.festivalId;

  // Transform API response to match CheckInPromptDialog interface
  const reservation = useMemo(() => {
    if (!reservationData) return null;
    return {
      id: reservationData.id,
      tent: reservationData.tentName
        ? { name: reservationData.tentName }
        : null,
      start_at: reservationData.startAt,
      visible_to_groups: reservationData.visibleToGroups,
      note: reservationData.note,
    };
  }, [reservationData]);

  // Handle attendance errors
  useEffect(() => {
    if (attendancesError) {
      toast.error(t("notifications.error.attendanceLoadFailed"));
    }
  }, [attendancesError, t]);

  // Handle reservation fetch errors
  useEffect(() => {
    if (reservationError) {
      toast.error(t("notifications.error.reservationNotFound"));
    }
  }, [reservationError, t]);

  // Handle date parameter from URL
  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        startTransition(() => {
          setSelectedDate(date);
        });
      }
    }
  }, [searchParams]);

  const handleAttendanceUpdate = useCallback(() => {
    refetchAttendances();
  }, [refetchAttendances]);

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
  };

  const handleAttendanceDelete = useCallback(() => {
    handleDateSelect(null);
    handleAttendanceUpdate();
  }, [handleAttendanceUpdate]);

  const handleCheckIn = useCallback(
    async (resId: string) => {
      if (!reservationFestivalId) return;
      await checkIn({
        reservationId: resId,
        festivalId: reservationFestivalId,
      });
      handleAttendanceUpdate();
    },
    [checkIn, handleAttendanceUpdate, reservationFestivalId],
  );

  if (festivalLoading || attendancesLoading || !currentFestival) {
    return (
      <div className="w-full max-w-lg flex flex-col gap-6">
        <p className="text-center text-gray-600">
          {t("common.status.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      <DetailedAttendanceForm
        onAttendanceUpdate={handleAttendanceUpdate}
        selectedDate={selectedDate}
      />
      <PersonalAttendanceTable
        data={attendances as AttendanceWithTentVisits[] | undefined}
        onDateSelect={handleDateSelect}
        onAttendanceDelete={handleAttendanceDelete}
      />
      <CheckInPromptDialog
        reservation={reservation}
        onCheckIn={handleCheckIn}
      />
    </div>
  );
}
