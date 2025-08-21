"use client";

import { useFestival } from "@/contexts/FestivalContext";
import { getFestivalStatus } from "@/lib/festivalConstants";

import QuickAttendanceRegistration from "./QuickAttendanceRegistration";

export function QuickAttendanceWrapper() {
  const { currentFestival, isLoading } = useFestival();

  // Don't show the component if still loading or no festival selected
  if (isLoading || !currentFestival) {
    return null;
  }

  // Only show QuickAttendanceRegistration for active festivals
  const festivalStatus = getFestivalStatus(currentFestival);
  if (festivalStatus !== "active") {
    return null;
  }

  return <QuickAttendanceRegistration />;
}
