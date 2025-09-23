"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFestival } from "@/contexts/FestivalContext";
import {
  getFestivalConstants,
  getFestivalStatus,
} from "@/lib/festivalConstants";
import { differenceInDays, isWithinInterval, isBefore } from "date-fns";

export default function FestivalStatus() {
  const { currentFestival, isLoading } = useFestival();

  if (isLoading || !currentFestival) {
    return (
      <p className="text-center text-gray-900 font-semibold px-4">
        Loading festival status...
      </p>
    );
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
    <Alert
      variant={
        festivalStatus === "active"
          ? "success"
          : festivalStatus === "upcoming"
            ? "info"
            : "warning"
      }
      className="w-fit"
    >
      <AlertDescription className="text-center font-semibold">
        {status}
      </AlertDescription>
    </Alert>
  );
}
