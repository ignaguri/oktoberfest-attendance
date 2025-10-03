"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonFestivalStatus } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import {
  getFestivalConstants,
  getFestivalStatus,
} from "@/lib/festivalConstants";
import { differenceInDays, isWithinInterval, isBefore } from "date-fns";
import { CalendarCheck } from "lucide-react";

import { WrappedCTA } from "./WrappedCTA";

export default function FestivalStatus() {
  const { currentFestival, isLoading } = useFestival();

  if (isLoading || !currentFestival) {
    return <SkeletonFestivalStatus />;
  }

  const { festivalStartDate, festivalEndDate, festivalName } =
    getFestivalConstants(currentFestival);
  const today = new Date();
  let status = "";

  if (isBefore(today, festivalStartDate)) {
    const daysRemaining = differenceInDays(festivalStartDate, today);
    status = `${festivalName} starts in ${
      daysRemaining <= 1 ? "a day" : `${daysRemaining} days`
    }!`;
  } else if (
    isWithinInterval(today, { start: festivalStartDate, end: festivalEndDate })
  ) {
    const currentDay = differenceInDays(today, festivalStartDate) + 1;
    const totalDays = differenceInDays(festivalEndDate, festivalStartDate) + 1;
    status = `It's day ${currentDay} / ${totalDays} of ${festivalName}!`;
  } else {
    status = `Sadly, ${festivalName} is over. See you next time!`;
  }

  const festivalStatus = getFestivalStatus(currentFestival);

  return (
    <>
      <Alert
        variant={
          festivalStatus === "active"
            ? "successLight"
            : festivalStatus === "upcoming"
              ? "info"
              : "warning"
        }
        className="w-fit"
      >
        <AlertDescription className="flex items-center gap-2">
          <CalendarCheck className="size-5" />
          <span className="font-semibold">{status}</span>
        </AlertDescription>
      </Alert>
      {festivalStatus === "ended" && <WrappedCTA />}
    </>
  );
}
