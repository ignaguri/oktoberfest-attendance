import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  differenceInDays,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { Clock, Flag, PartyPopper } from "lucide-react-native";

type FestivalStatusType = "upcoming" | "active" | "ended";

interface StatusConfig {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<FestivalStatusType, StatusConfig> = {
  upcoming: {
    icon: <Clock size={20} color={IconColors.primary} />,
    bgColor: "bg-primary-50",
    textColor: "text-primary-700",
  },
  active: {
    icon: <PartyPopper size={20} color={IconColors.success} />,
    bgColor: "bg-success-50",
    textColor: "text-success-700",
  },
  ended: {
    icon: <Flag size={20} color={IconColors.muted} />,
    bgColor: "bg-background-100",
    textColor: "text-typography-500",
  },
};

/**
 * Festival status card showing countdown, current day, or ended status
 *
 * Features:
 * - Before festival: Shows countdown in days
 * - During festival: Shows "Day X of Y"
 * - After festival: Shows "Festival has ended"
 */
export function FestivalStatus() {
  const { t } = useTranslation();
  const { currentFestival, isLoading } = useFestival();

  if (isLoading || !currentFestival) {
    return null;
  }

  const today = startOfDay(new Date());
  const startDate = startOfDay(parseISO(currentFestival.startDate));
  const endDate = startOfDay(parseISO(currentFestival.endDate));

  // Determine festival status
  let status: FestivalStatusType;
  let message: string;

  if (isBefore(today, startDate)) {
    // Festival hasn't started yet
    status = "upcoming";
    const daysUntil = differenceInDays(startDate, today);
    message =
      daysUntil === 1
        ? t("home.festivalStatus.startsInOneDay", {
            defaultValue: "Festival starts tomorrow!",
          })
        : t("home.festivalStatus.startsInDays", {
            defaultValue: `Festival starts in ${daysUntil} days`,
            daysUntil,
          });
  } else if (isAfter(today, endDate)) {
    // Festival has ended
    status = "ended";
    message = t("home.festivalStatus.ended", {
      defaultValue: "Festival has ended",
    });
  } else {
    // Festival is currently active
    status = "active";
    const currentDay = differenceInDays(today, startDate) + 1;
    const totalDays = differenceInDays(endDate, startDate) + 1;
    message = t("home.festivalStatus.currentDay", {
      defaultValue: `Day ${currentDay} of ${totalDays}`,
      currentDay,
      totalDays,
    });
  }

  const config = STATUS_CONFIG[status];

  return (
    <Card size="sm" variant="filled" className={`${config.bgColor} border-0`}>
      <HStack space="sm" className="items-center">
        {config.icon}
        <Text className={`flex-1 font-medium ${config.textColor}`}>
          {message}
        </Text>
        {status === "active" && (
          <Text className="text-sm text-typography-500">
            {currentFestival.name}
          </Text>
        )}
      </HStack>
    </Card>
  );
}

FestivalStatus.displayName = "FestivalStatus";
