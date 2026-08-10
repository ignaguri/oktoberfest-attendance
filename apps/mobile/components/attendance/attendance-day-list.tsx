import { useTranslation } from "@prostcounter/shared/i18n";
import type { AttendanceWithTotals } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { isSameDay, parseISO } from "date-fns";
import { Image as ImageIcon } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import type { DaySummaries } from "@/lib/database/adapted-hooks";

import { DrinkCountSummary } from "./drink-count-summary";

/** Names shown inline before the row collapses the rest into "+N". */
const MAX_VISIBLE_TENTS = 2;

interface AttendanceDayListProps {
  attendances: AttendanceWithTotals[];
  summaries: DaySummaries | null;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

function formatEuros(cents: number): string {
  return `€${Math.round(cents / 100)}`;
}

/**
 * List of days that have an attendance record, most recent first.
 *
 * Complements the strip: the strip shows which days exist and is where you plan
 * and log, the list shows what each logged day actually cost and where it
 * happened — detail a 48pt cell cannot carry.
 */
export function AttendanceDayList({
  attendances,
  summaries,
  selectedDate,
  onDateSelect,
}: AttendanceDayListProps) {
  const { t } = useTranslation();

  function handlePress(dateStr: string) {
    onDateSelect(parseISO(dateStr));
  }

  if (attendances.length === 0) {
    return (
      <VStack space="xs" className="items-center rounded-xl bg-background-0 p-8">
        <Text className="text-center font-medium text-typography-700">
          {t("attendance.noAttendances")}
        </Text>
        <Text className="text-center text-sm text-typography-500">
          {t("attendance.noAttendancesDescription")}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack space="xs" className="rounded-xl bg-background-0 p-2">
      {attendances.map((attendance) => {
        const date = parseISO(attendance.date);
        const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
        const tentNames = summaries?.tentNames.get(attendance.date) ?? [];
        const drinkCounts = summaries?.drinkCounts.get(attendance.date);
        const photoCount = summaries?.photoCounts.get(attendance.date) ?? 0;

        const visibleTents = tentNames.slice(0, MAX_VISIBLE_TENTS);
        const hiddenTentCount = tentNames.length - visibleTents.length;

        const accessibilityLabelParts = [
          formatLocalized(date, "EEEE, MMMM d"),
          t("attendance.list.a11ySpent", { amount: formatEuros(attendance.totalSpentCents) }),
          t("attendance.list.a11yDrinks", { total: attendance.drinkCount }),
        ];
        if (attendance.totalTipCents > 0) {
          accessibilityLabelParts.push(
            t("attendance.list.tip", { amount: formatEuros(attendance.totalTipCents) }),
          );
        }
        if (tentNames.length > 0) {
          accessibilityLabelParts.push(tentNames.join(", "));
        }

        return (
          <Pressable
            key={attendance.date}
            onPress={() => handlePress(attendance.date)}
            className={cn("rounded-lg p-3", isSelected ? "bg-primary-100" : "bg-transparent")}
            accessibilityLabel={accessibilityLabelParts.join(", ")}
            accessibilityHint={t("attendance.calendar.tapToAddOrEdit")}
          >
            <VStack space="xs">
              <HStack className="items-center justify-between">
                <Text className="font-medium text-typography-900">
                  {formatLocalized(date, "EEE, MMM d")}
                </Text>
                <Text className="font-semibold text-primary-600">
                  {formatEuros(attendance.totalSpentCents)}
                </Text>
              </HStack>

              <HStack className="items-center justify-between">
                <DrinkCountSummary counts={drinkCounts} compact showTotal={false} />

                <HStack space="sm" className="items-center">
                  {attendance.totalTipCents > 0 && (
                    <Text className="text-xs text-success-600">
                      {t("attendance.list.tip", {
                        amount: formatEuros(attendance.totalTipCents),
                      })}
                    </Text>
                  )}
                  {photoCount > 0 && <ImageIcon size={14} color={IconColors.muted} />}
                </HStack>
              </HStack>

              {visibleTents.length > 0 && (
                <HStack space="xs" className="items-center">
                  <Text className="text-xs text-typography-500" numberOfLines={1}>
                    {visibleTents.join(", ")}
                  </Text>
                  {hiddenTentCount > 0 && (
                    <Text className="text-xs text-typography-400">
                      {t("attendance.list.moreTents", { amount: hiddenTentCount })}
                    </Text>
                  )}
                </HStack>
              )}
            </VStack>
          </Pressable>
        );
      })}
    </VStack>
  );
}

AttendanceDayList.displayName = "AttendanceDayList";
