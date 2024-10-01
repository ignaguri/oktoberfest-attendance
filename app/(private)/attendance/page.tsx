"use client";

import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";

import type { Tables } from "@/lib/database.types";

import { fetchAttendances } from "./actions";
import DetailedAttendanceForm from "./DetailedAttendanceForm";
import PersonalAttendanceTable from "./PersonalAttendanceTable";

type TentVisit = Tables<"tent_visits"> & {
  tentName: string | undefined;
};

export type AttendanceWithTentVisits = Tables<"attendances"> & {
  tentVisits: TentVisit[];
};

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<AttendanceWithTentVisits[]>(
    [],
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchAttendanceData = useCallback(async () => {
    try {
      const data = await fetchAttendances();
      if (data) {
        setAttendances(data as AttendanceWithTentVisits[]);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch attendance data. Please try again.",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

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
    </div>
  );
}
