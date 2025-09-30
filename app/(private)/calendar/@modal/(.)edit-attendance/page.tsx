"use client";

import DetailedAttendanceForm from "@/app/(private)/attendance/DetailedAttendanceForm";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useEffect } from "react";

export default function InterceptedAttendanceModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    return d ? new Date(d) : null;
  }, [searchParams]);

  const handleClose = () => {
    router.back();
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.back();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [router]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DetailedAttendanceForm
            onAttendanceUpdate={handleClose}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </>
  );
}
