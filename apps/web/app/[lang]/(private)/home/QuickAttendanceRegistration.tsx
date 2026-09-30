"use client";

import { useCallback, useState } from "react";

import { CrowdReportDialog } from "@/components/crowd/CrowdReportDialog";

import { BeerPictureUpload } from "./components/BeerPictureUpload";
import { QuickAttendanceRegistrationForm } from "./components/QuickAttendanceRegistrationForm";

const QuickAttendanceRegistration = () => {
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [crowdReportTentId, setCrowdReportTentId] = useState<string | null>(null);

  const handleAttendanceIdReceived = (id: string) => {
    setAttendanceId(id);
  };

  const handleTentSelected = useCallback((tentId: string) => {
    setCrowdReportTentId(tentId);
  }, []);

  return (
    <div className="flex w-full flex-col gap-2">
      <QuickAttendanceRegistrationForm
        onAttendanceIdReceived={handleAttendanceIdReceived}
        onTentSelected={handleTentSelected}
        attendanceId={attendanceId}
        renderPhotoUpload={(id) => <BeerPictureUpload attendanceId={id} />}
      />
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
