"use client";

import DetailedAttendanceForm from "@/app/(private)/attendance/DetailedAttendanceForm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo } from "react";

export function AttendanceDialog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const open = searchParams.get("editAttendance") === "1";
  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    return d ? new Date(d) : null;
  }, [searchParams]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("editAttendance");
          router.replace(`?${params.toString()}`);
        }
      }}
    >
      <DialogContent className="max-w-lg w-full p-0">
        <DetailedAttendanceForm
          onAttendanceUpdate={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("editAttendance");
            router.replace(`?${params.toString()}`);
          }}
          selectedDate={selectedDate}
        />
      </DialogContent>
    </Dialog>
  );
}
