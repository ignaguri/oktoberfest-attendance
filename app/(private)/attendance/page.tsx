"use client";

import { useState, useEffect, useCallback } from "react";
import DetailedAttendanceForm from "./DetailedAttendanceForm";
import PersonalAttendanceTable from "./PersonalAttendanceTable";
import { fetchAttendances } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/lib/database.types";

type AttendanceDBType = Tables<"attendances">;

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<
    Pick<AttendanceDBType, "date" | "beer_count">[]
  >([]);
  const { toast } = useToast();

  const fetchAttendanceData = useCallback(async () => {
    try {
      const data = await fetchAttendances();
      setAttendances(data as Pick<AttendanceDBType, "date" | "beer_count">[]);
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

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      <DetailedAttendanceForm onAttendanceUpdate={handleAttendanceUpdate} />
      <PersonalAttendanceTable data={attendances} />
    </div>
  );
}
