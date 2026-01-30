"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import {
  differenceInDays,
  endOfDay,
  isBefore,
  isWithinInterval,
} from "date-fns";
import { CalendarCheck, Frown } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonFestivalStatus } from "@/components/ui/skeleton-cards";
import {
  getFestivalConstants,
  getFestivalStatus,
} from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";

import { WrappedCTA } from "./WrappedCTA";

export default function FestivalStatus() {
  const { t } = useTranslation();
  const { currentFestival, isLoading } = useFestival();

  if (isLoading || !currentFestival) {
    return <SkeletonFestivalStatus />;
  }

  const { festivalStartDate, festivalEndDate } =
    getFestivalConstants(currentFestival);
  const today = new Date();
  let status = "";

  if (isBefore(today, festivalStartDate)) {
    const daysRemaining = differenceInDays(festivalStartDate, today);
    status =
      daysRemaining <= 1
        ? t("home.festivalStatus.startsInOneDay")
        : t("home.festivalStatus.startsInDays", { daysUntil: daysRemaining });
  } else if (
    isWithinInterval(today, {
      start: festivalStartDate,
      end: endOfDay(festivalEndDate),
    })
  ) {
    const currentDay = differenceInDays(today, festivalStartDate) + 1;
    const totalDays = differenceInDays(festivalEndDate, festivalStartDate) + 1;
    status = t("home.festivalStatus.currentDay", { currentDay, totalDays });
  } else {
    status = t("home.festivalStatus.ended");
  }

  const festivalStatus = getFestivalStatus(currentFestival);

  return (
    <div className="flex flex-col items-center gap-2">
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
          {festivalStatus === "ended" ? (
            <Frown className="size-5" />
          ) : (
            <CalendarCheck className="size-5" />
          )}
          <span className="font-semibold">{status}</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-bold">{currentFestival.name}</span>
        </AlertDescription>
      </Alert>
      {festivalStatus === "ended" && <WrappedCTA />}
    </div>
  );
}
