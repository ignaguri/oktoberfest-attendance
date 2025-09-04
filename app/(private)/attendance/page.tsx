"use client";

import { CheckInPromptDialog } from "@/components/reservations/CheckInPromptDialog";
import { useFestival } from "@/contexts/FestivalContext";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

import type { Tables } from "@/lib/database.types";

import { fetchAttendances, checkInFromReservation } from "./actions";
import DetailedAttendanceForm from "./DetailedAttendanceForm";
import PersonalAttendanceTable from "./PersonalAttendanceTable";
import { getReservationForCheckIn } from "../calendar/actions";

type TentVisit = Tables<"tent_visits"> & {
  tentName: string | undefined;
};

export type AttendanceWithTentVisits = Tables<"attendances"> & {
  tentVisits: TentVisit[];
};

export default function AttendancePage() {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const [attendances, setAttendances] = useState<AttendanceWithTentVisits[]>(
    [],
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reservation, setReservation] = useState<any>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const fetchAttendanceData = useCallback(async () => {
    if (!currentFestival) return;

    try {
      const data = await fetchAttendances(currentFestival.id);
      if (data) {
        setAttendances(data as AttendanceWithTentVisits[]);
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch attendance data. Please try again.",
      });
    }
  }, [toast, currentFestival]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // Handle date parameter from URL
  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
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
          const reservationData = await getReservationForCheckIn(reservationId);
          setReservation(reservationData);
        } catch (error) {
          console.error("Error fetching reservation:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Reservation not found or already processed.",
          });
        }
      };

      fetchReservation();
    } else {
      setReservation(null);
    }
  }, [searchParams, toast]);

  const handleAttendanceUpdate = useCallback(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
  };

  const handleAttendanceDelete = useCallback(() => {
    handleDateSelect(null);
    handleAttendanceUpdate();
  }, [handleAttendanceUpdate]);

  const handleCheckIn = useCallback(
    async (reservationId: string) => {
      await checkInFromReservation(reservationId);
      handleAttendanceUpdate();
    },
    [handleAttendanceUpdate],
  );

  if (festivalLoading || !currentFestival) {
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
        data={attendances}
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
