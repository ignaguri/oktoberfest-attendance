"use client";

import { useState } from "react";
import { BeerPictureUpload } from "./components/BeerPictureUpload";
import { QuickAttendanceRegistrationForm } from "./components/QuickAttendanceRegistrationForm";

const QuickAttendanceRegistration = () => {
  const [attendanceId, setAttendanceId] = useState<string | null>(null);

  const handleAttendanceIdReceived = (id: string) => {
    setAttendanceId(id);
  };

  return (
    <div className="flex flex-col gap-4">
      <QuickAttendanceRegistrationForm
        onAttendanceIdReceived={handleAttendanceIdReceived}
      />
      <BeerPictureUpload attendanceId={attendanceId} />
    </div>
  );
};

export default QuickAttendanceRegistration;
