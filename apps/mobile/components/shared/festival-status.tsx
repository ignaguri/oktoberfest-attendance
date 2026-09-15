import { useFestival } from "@prostcounter/shared/contexts";
import { useFestivalCountdown, useHighlights } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getPreviousFestivalInSeries } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { Beer, Clock, Flag, PartyPopper } from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

type FestivalStatusType = "upcoming" | "active" | "ended";

interface StatusConfig {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<FestivalStatusType, StatusConfig> = {
  upcoming: {
    icon: <Clock size={28} color={IconColors.primary} />,
    bgColor: "bg-primary-50",
    textColor: "text-primary-700",
  },
  active: {
    icon: <PartyPopper size={28} color="#16a34a" />,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
  },
  ended: {
    icon: <Flag size={28} color={IconColors.muted} />,
    bgColor: "bg-background-100",
    textColor: "text-typography-500",
  },
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Festival hero: live countdown to the opening while upcoming, and a compact
 * single-line card for "O'zapft is! Day X of Y" while live, and the ended
 * state afterwards. Shows last time's stats for the same festival series
 * while upcoming, when available.
 */
export function FestivalStatus() {
  const { t } = useTranslation();
  const { currentFestival, festivals, isLoading } = useFestival();
  const countdown = useFestivalCountdown(currentFestival);
  const previousFestival = currentFestival
    ? getPreviousFestivalInSeries(currentFestival, festivals)
    : null;
  const { data: previousHighlights } = useHighlights(
    countdown?.phase === "upcoming" ? previousFestival?.id : undefined,
  );

  if (isLoading || !currentFestival || !countdown) {
    return null;
  }

  if (countdown.phase !== "upcoming") {
    const compactConfig = countdown.phase === "live" ? STATUS_CONFIG.active : STATUS_CONFIG.ended;
    const compactMessage =
      countdown.phase === "live"
        ? t("home.festivalStatus.live", {
            currentDay: countdown.currentDay,
            totalDays: countdown.totalDays,
          })
        : t("home.festivalStatus.ended");

    return (
      <Card size="md" variant="filled" className={cn(compactConfig.bgColor, "border border-outline-200")}>
        <HStack space="sm" className="items-center justify-center">
          {compactConfig.icon}
          <Text className={cn("text-base font-semibold", compactConfig.textColor)}>
            {compactMessage}
          </Text>
          <Text className="text-typography-400">•</Text>
          <Text className="text-base font-bold text-typography-700">{currentFestival.name}</Text>
        </HStack>
      </Card>
    );
  }

  const headline = countdown.isOpeningDay
    ? t("home.festivalStatus.openingToday")
    : t("home.festivalStatus.countdownLabel");

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
    <Card
      size="md"
      variant="filled"
      className={cn(STATUS_CONFIG.upcoming.bgColor, "border border-outline-200")}
    >
      <VStack space="xs" className="items-center">
        <HStack space="sm" className="items-center justify-center">
          {STATUS_CONFIG.upcoming.icon}
          <Text className={cn("text-base font-semibold", STATUS_CONFIG.upcoming.textColor)}>
            {headline}
          </Text>
        </HStack>
        {countdown.remaining && (
          <Text
            className={cn("text-3xl font-extrabold", STATUS_CONFIG.upcoming.textColor)}
            accessibilityLabel={t("home.festivalStatus.countdownAccessibility", {
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
          </Text>
        )}
        <Text className="text-base font-bold text-typography-700">{currentFestival.name}</Text>
        {lastTimeLine && (
          <HStack space="xs" className="items-center">
            <Beer size={14} color={IconColors.primary} />
            <Text className={cn("text-sm", STATUS_CONFIG.upcoming.textColor)}>{lastTimeLine}</Text>
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

FestivalStatus.displayName = "FestivalStatus";
