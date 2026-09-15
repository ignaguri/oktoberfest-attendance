"use client";

import { getFestivalCountdown, type FestivalCountdown } from "@prostcounter/shared/utils";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import type { CountdownFestival } from "@/lib/marketing/getCountdownFestival";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function FestivalCountdownBanner({ festival }: { festival: CountdownFestival }) {
  const { t } = useTranslation();
  // null until mounted: the server has no "now" worth rendering, and a
  // server-side clock would mismatch on hydration.
  const [countdown, setCountdown] = useState<FestivalCountdown | null>(null);

  useEffect(() => {
    const update = () => setCountdown(getFestivalCountdown(festival));
    update();
    const intervalId = setInterval(update, 1_000);
    return () => clearInterval(intervalId);
  }, [festival]);

  if (countdown?.phase === "ended") {
    return null;
  }

  return (
    <section className="flex w-full flex-col items-center gap-3 bg-yellow-500 px-4 py-6 text-center text-stone-900">
      <p className="text-lg font-semibold">
        {countdown?.phase === "live"
          ? t("festivalCountdown.live", {
              festivalName: festival.name,
              currentDay: countdown.currentDay,
              totalDays: countdown.totalDays,
            })
          : t("festivalCountdown.opensIn", { festivalName: festival.name })}
      </p>
      <p className="min-h-10 font-mono text-4xl font-extrabold tabular-nums" aria-live="off">
        {countdown?.phase === "upcoming" && countdown.remaining
          ? `${countdown.remaining.days}${t("home.festivalStatus.unitDays")} ${pad(countdown.remaining.hours)}${t("home.festivalStatus.unitHours")} ${pad(countdown.remaining.minutes)}${t("home.festivalStatus.unitMinutes")} ${pad(countdown.remaining.seconds)}${t("home.festivalStatus.unitSeconds")}`
          : null}
      </p>
      <Button asChild variant="secondary">
        <Link href="/sign-up">{t("festivalCountdown.cta")}</Link>
      </Button>
    </section>
  );
}
