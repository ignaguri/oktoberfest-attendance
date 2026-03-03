"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { isSameDay } from "date-fns";
import { useCallback, useState } from "react";

import { CrowdReportDialog } from "@/components/crowd/CrowdReportDialog";
import { getFestivalConstants } from "@/lib/festivalConstants";

import { BeerPictureUpload } from "./components/BeerPictureUpload";
import { QuickAttendanceRegistrationForm } from "./components/QuickAttendanceRegistrationForm";
import { WrappedCTA } from "./WrappedCTA";

const QuickAttendanceRegistration = () => {
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [crowdReportTentId, setCrowdReportTentId] = useState<string | null>(
    null,
  );
  const { currentFestival } = useFestival();

  const handleAttendanceIdReceived = (id: string) => {
    setAttendanceId(id);
  };

  const handleTentSelected = useCallback((tentId: string) => {
    setCrowdReportTentId(tentId);
  }, []);

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
    <div className="flex w-full flex-col gap-2">
      <QuickAttendanceRegistrationForm
        onAttendanceIdReceived={handleAttendanceIdReceived}
        onTentSelected={handleTentSelected}
        attendanceId={attendanceId}
        renderPhotoUpload={(id) => <BeerPictureUpload attendanceId={id} />}
      />
      {isLastDayOfFestival && (
        <WrappedCTA isLastDayOfFestival={isLastDayOfFestival} />
      )}
      <CrowdReportDialog
        open={!!crowdReportTentId}
        onOpenChange={(open) => {
          if (!open) setCrowdReportTentId(null);
        }}
        preselectedTentId={crowdReportTentId ?? undefined}
      />
    </div>
  );
};

export default QuickAttendanceRegistration;
