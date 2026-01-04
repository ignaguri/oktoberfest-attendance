"use client";

import { CheckInPromptDialog } from "@/components/reservations/CheckInPromptDialog";
import { useFestival } from "@/contexts/FestivalContext";
import { apiClient } from "@/lib/api-client";
import { useAttendances } from "@/lib/data";
import { logger } from "@/lib/logger";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, startTransition } from "react";
import { toast } from "sonner";

import type { AttendanceWithTotals } from "@prostcounter/shared/schemas";

import DetailedAttendanceForm from "./DetailedAttendanceForm";
import PersonalAttendanceTable from "./PersonalAttendanceTable";

// Re-export API type for component use
export type AttendanceWithTentVisits = AttendanceWithTotals;

export default function AttendancePage() {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    data: attendances,
    loading: attendancesLoading,
    error: attendancesError,
    refetch: refetchAttendances,
  } = useAttendances(currentFestival?.id || "");

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reservation, setReservation] = useState<any>(null);
  const searchParams = useSearchParams();

  // Handle attendance errors
  useEffect(() => {
    if (attendancesError) {
      toast.error("Failed to fetch attendance data. Please try again.");
    }
  }, [attendancesError]);

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

  // Handle check-in prompt
  useEffect(() => {
    const reservationId = searchParams.get("reservationId");
    const prompt = searchParams.get("prompt");

    if (prompt === "checkin" && reservationId) {
      const fetchReservation = async () => {
        try {
          const { reservation } =
            await apiClient.reservations.get(reservationId);
          setReservation(reservation);
        } catch (error) {
          logger.error(
            "Error fetching reservation",
            logger.clientComponent("AttendancePage", { reservationId }),
            error as Error,
          );
          toast.error("Reservation not found or already processed.");
        }
      };

      fetchReservation();
    } else {
      startTransition(() => {
        setReservation(null);
      });
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
    async (reservationId: string) => {
      await apiClient.attendance.checkInFromReservation(reservationId);
      handleAttendanceUpdate();
    },
    [handleAttendanceUpdate],
  );

  if (festivalLoading || attendancesLoading || !currentFestival) {
    return (
      <div className="w-full max-w-lg flex flex-col gap-6">
        <p className="text-center text-gray-600">Loading festival data...</p>
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
