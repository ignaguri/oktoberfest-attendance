"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFestival } from "@/contexts/FestivalContext";
import {
  getFestivalConstants,
  getFestivalStatus,
} from "@/lib/festivalConstants";
import { differenceInDays, isWithinInterval, isBefore } from "date-fns";
import { OctagonAlert } from "lucide-react";

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
      daysRemaining === 1 ? "a day" : `${daysRemaining} days`
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
      <p className="text-center text-gray-900 font-semibold px-4">{status}</p>
      {festivalStatus === "upcoming" && (
        <Alert variant="warning" className="mt-4">
          <OctagonAlert className="w-4 h-4" />
          <AlertDescription>
            All attendance data loaded now is just for testing and will be
            deleted before {festivalName} starts.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
