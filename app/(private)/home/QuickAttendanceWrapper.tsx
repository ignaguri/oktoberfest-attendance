"use client";

import { SkeletonQuickAttendance } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { getFestivalStatus } from "@/lib/festivalConstants";

import QuickAttendanceRegistration from "./QuickAttendanceRegistration";

export function QuickAttendanceWrapper() {
  const { currentFestival, isLoading } = useFestival();

  // Show skeleton while loading or no festival selected
  if (isLoading || !currentFestival) {
    return <SkeletonQuickAttendance />;
  }

  // Only show QuickAttendanceRegistration for active festivals
  const festivalStatus = getFestivalStatus(currentFestival);
  if (festivalStatus !== "active") {
    return null;
  }

  return <QuickAttendanceRegistration />;
}
