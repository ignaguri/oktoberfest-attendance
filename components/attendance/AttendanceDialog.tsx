"use client";

import DetailedAttendanceForm from "@/app/(private)/attendance/DetailedAttendanceForm";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
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

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("editAttendance");
    const url = params.toString() ? `?${params.toString()}` : "/calendar";
    router.replace(url);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <div className="max-w-lg w-full mx-auto p-4">
          <DetailedAttendanceForm
            onAttendanceUpdate={handleClose}
            selectedDate={selectedDate}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
