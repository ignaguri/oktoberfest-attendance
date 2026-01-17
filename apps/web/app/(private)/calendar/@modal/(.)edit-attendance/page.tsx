"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import DetailedAttendanceForm from "@/app/(private)/attendance/DetailedAttendanceForm";
import { Button } from "@/components/ui/button";

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
        className="animate-in fade-in fixed inset-0 z-50 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="animate-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center p-4 duration-200">
        <div
          className="bg-background relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-muted absolute right-2 top-2 z-10 h-8 w-8 p-0"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X className="size-4" />
          </Button>

          <DetailedAttendanceForm
            onAttendanceUpdate={handleClose}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </>
  );
}
