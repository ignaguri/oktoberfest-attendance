"use client";

import { useFestival } from "@/contexts/FestivalContext";
import { getFestivalConstants } from "@/lib/festivalConstants";
import { isSameDay } from "date-fns";
import { useState } from "react";

import { BeerPictureUpload } from "./components/BeerPictureUpload";
import { QuickAttendanceRegistrationForm } from "./components/QuickAttendanceRegistrationForm";
import { WrappedCTA } from "./WrappedCTA";

const QuickAttendanceRegistration = () => {
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const { currentFestival } = useFestival();

  const handleAttendanceIdReceived = (id: string) => {
    setAttendanceId(id);
  };

  // Calculate if today is the last day of the current festival
  const today = new Date();
  const { festivalEndDate } = currentFestival
    ? getFestivalConstants(currentFestival)
    : { festivalEndDate: null };
  const isLastDayOfFestival =
    currentFestival && festivalEndDate
      ? isSameDay(today, festivalEndDate)
      : false;

  return (
    <div className="flex flex-col gap-2">
      <QuickAttendanceRegistrationForm
        onAttendanceIdReceived={handleAttendanceIdReceived}
      />
      <BeerPictureUpload attendanceId={attendanceId} />
      {isLastDayOfFestival && (
        <WrappedCTA isLastDayOfFestival={isLastDayOfFestival} />
      )}
    </div>
  );
};

export default QuickAttendanceRegistration;
