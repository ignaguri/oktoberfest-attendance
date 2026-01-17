"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import DetailedAttendanceForm from "@/app/(private)/attendance/DetailedAttendanceForm";
import { Button } from "@/components/ui/button";

export default function DirectAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    return d ? new Date(d) : null;
  }, [searchParams]);

  return (
    <div className="container mx-auto max-w-lg p-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/calendar")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Calendar
      </Button>

      <DetailedAttendanceForm
        onAttendanceUpdate={() => router.push("/calendar")}
        selectedDate={selectedDate}
      />
    </div>
  );
}
