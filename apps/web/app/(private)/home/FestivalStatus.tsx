"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useFestivalCountdown, useHighlights } from "@prostcounter/shared/hooks";
import { getPreviousFestivalInSeries } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { Beer, CalendarCheck, Frown, PartyPopper } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonFestivalStatus } from "@/components/ui/skeleton-cards";
import { useTranslation } from "@/lib/i18n/client";

import { WrappedCTA } from "./WrappedCTA";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export default function FestivalStatus() {
  const { t } = useTranslation();
  const { currentFestival, festivals, isLoading } = useFestival();
  const countdown = useFestivalCountdown(currentFestival);
  const previousFestival = currentFestival
    ? getPreviousFestivalInSeries(currentFestival, festivals)
    : null;
  const { data: previousHighlights } = useHighlights(previousFestival?.id);

  if (isLoading || !currentFestival || !countdown) {
    return <SkeletonFestivalStatus />;
  }

  if (countdown.phase === "ended") {
    return (
      <div className="flex flex-col items-center gap-2">
        <Alert variant="warning" className="w-fit">
          <AlertDescription className="flex items-center gap-2">
            <Frown className="size-5" />
            <span className="font-semibold">{t("home.festivalStatus.ended")}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-bold">{currentFestival.name}</span>
          </AlertDescription>
        </Alert>
        <WrappedCTA />
      </div>
    );
  }

  const isUpcoming = countdown.phase === "upcoming";
  const lastTimeLine =
    previousFestival && previousHighlights && previousHighlights.totalDays > 0
      ? t("home.festivalStatus.lastTime", {
          festivalName: previousFestival.name,
          beers: previousHighlights.totalBeers,
          days: previousHighlights.totalDays,
        })
      : previousHighlights
        ? t("home.festivalStatus.firstTime")
        : null;

  return (
    <Alert variant={isUpcoming ? "info" : "successLight"} className="w-fit">
      <AlertDescription className="flex flex-col items-center gap-1 text-center">
        <span className="flex items-center gap-2 font-semibold">
          {isUpcoming ? <CalendarCheck className="size-5" /> : <PartyPopper className="size-5" />}
          {isUpcoming
            ? countdown.isOpeningDay
              ? t("home.festivalStatus.openingToday")
              : t("home.festivalStatus.countdownLabel")
            : t("home.festivalStatus.live", {
                currentDay: countdown.currentDay,
                totalDays: countdown.totalDays,
              })}
        </span>
        {isUpcoming && countdown.remaining && (
          <span
            className="font-mono text-2xl font-extrabold tabular-nums"
            aria-label={t("home.festivalStatus.countdownAccessibility", {
              days: countdown.remaining.days,
              hours: countdown.remaining.hours,
              minutes: countdown.remaining.minutes,
              festivalName: currentFestival.name,
            })}
          >
            {countdown.remaining.days}
            {t("home.festivalStatus.unitDays")} {pad(countdown.remaining.hours)}
            {t("home.festivalStatus.unitHours")} {pad(countdown.remaining.minutes)}
            {t("home.festivalStatus.unitMinutes")} {pad(countdown.remaining.seconds)}
            {t("home.festivalStatus.unitSeconds")}
          </span>
        )}
        <span className="font-bold">{currentFestival.name}</span>
        {lastTimeLine && (
          <span className={cn("flex items-center gap-1 text-sm", "text-muted-foreground")}>
            <Beer className="size-4" />
            {lastTimeLine}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
