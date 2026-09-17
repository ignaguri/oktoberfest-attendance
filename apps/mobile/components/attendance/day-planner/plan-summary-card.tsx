import { useTranslation } from "@prostcounter/shared/i18n";
import type { DayPlan } from "@prostcounter/shared/schemas";
import { formatTimeInTimezone } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { parseISO } from "date-fns";
import { CalendarClock, ChevronRight, Footprints } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatCompanionNames } from "@/lib/attendance/day-plans";
import { IconColors } from "@/lib/constants/colors";

interface PlanSummaryCardProps {
  plan: DayPlan;
  /** The festival's timezone, so the arrival time reads as it was booked. */
  timezone: string;
  onEdit: () => void;
}

/** The saved plan or reservation, compact. Tapping it opens the editor. */
export function PlanSummaryCard({ plan, timezone, onEdit }: PlanSummaryCardProps) {
  const { t } = useTranslation();
  const isReservation = plan.kind === "reservation";
  const title = isReservation
    ? t("attendance.planner.summaryReservation")
    : t("attendance.planner.summaryPlan");
  const arrival = plan.startAt ? formatTimeInTimezone(parseISO(plan.startAt), timezone) : null;
  const details = [plan.tentName, arrival, plan.note ? `"${plan.note}"` : null]
    .filter(Boolean)
    .join(" · ");
  const companionNames = formatCompanionNames(plan.companions, {
    viewerId: null,
    you: t("attendance.planner.companionYou"),
    unknown: t("attendance.planner.unknownFriend"),
  });
  const companionsLine = companionNames
    ? t("attendance.planner.withCompanions", { names: companionNames })
    : null;

  return (
    <Pressable
      onPress={onEdit}
      className={cn(
        "rounded-xl px-3 py-3",
        isReservation
          ? "border border-teal-300 bg-teal-50"
          : "border-2 border-dashed border-teal-400 bg-background-0",
      )}
      accessibilityRole="button"
      accessibilityLabel={[title, details, companionsLine].filter(Boolean).join(", ")}
      accessibilityHint={t("attendance.planner.editHint")}
    >
      <HStack space="md" className="items-center">
        {isReservation ? (
          <CalendarClock size={20} color={IconColors.reservation} />
        ) : (
          <Footprints size={20} color={IconColors.plan} />
        )}
        <VStack className="flex-1">
          <Text className="font-semibold text-teal-700">{title}</Text>
          {details.length > 0 && (
            <Text className="text-xs text-typography-600" numberOfLines={2}>
              {details}
            </Text>
          )}
          {companionsLine && (
            <Text className="text-xs text-typography-600" numberOfLines={2}>
              {companionsLine}
            </Text>
          )}
        </VStack>
        <ChevronRight size={18} color={IconColors.muted} />
      </HStack>
    </Pressable>
  );
}
