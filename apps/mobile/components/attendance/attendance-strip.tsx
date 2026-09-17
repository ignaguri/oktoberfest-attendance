import { TIMEZONE } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { DayPlan } from "@prostcounter/shared/schemas";
import { buildFestivalWeeks, formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { addDays, format, isSameDay } from "date-fns";
import { Beer, CalendarClock, Footprints } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  buildDayPlansByDate,
  festivalTodayKey,
  formatFriendsBadge,
  resolveCellTopSlot,
} from "@/lib/attendance/day-plans";
import { Colors, IconColors } from "@/lib/constants/colors";

interface AttendanceData {
  date: string;
  drinkCount: number;
}

interface AttendanceStripProps {
  festivalStartDate: Date;
  festivalEndDate: Date;
  attendances: AttendanceData[];
  /** The user's own marks, both kinds. Inactive reservations are ignored. */
  plans?: DayPlan[];
  /** How many friends have a visible plan or reservation, per YYYY-MM-DD. */
  friendsCountByDate?: Map<string, number>;
  /** Today is the festival's today, as the day sheet and the API decide it. */
  festivalTimezone?: string | null;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

// Week starts on Monday (ISO standard, used in Europe)
const WEEK_STARTS_ON = 1 as const;

/** One size for every day indicator, so icons sitting side by side match. */
const INDICATOR_ICON_SIZE = 10;

const NO_FRIENDS = new Map<string, number>();

/**
 * Weekday headers, generated from a known Monday so they always match the grid.
 * Jan 1 2024 is a Monday, so the seven days from it are one aligned week.
 */
function getWeekdayHeaders(): string[] {
  const referenceMonday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    formatLocalized(addDays(referenceMonday, index), "EEE"),
  );
}

/**
 * Strip of every day in the festival window, weekday-aligned.
 *
 * Cells are 56pt tall with three fixed rows: a top slot (TODAY or the month on
 * the 1st), the day number, and the indicators. The old 48pt cell stacked the
 * same content with an absolutely positioned today bar that landed on the
 * number. Festivals span at most three or four weeks, so the height is cheap.
 */
export function AttendanceStrip({
  festivalStartDate,
  festivalEndDate,
  attendances,
  plans = [],
  friendsCountByDate = NO_FRIENDS,
  festivalTimezone,
  selectedDate,
  onDateSelect,
}: AttendanceStripProps) {
  const { t } = useTranslation();
  // Worked out on every render, so it moves on past midnight with the next update.
  const todayKey = festivalTodayKey(new Date(), festivalTimezone ?? TIMEZONE);
  const weekdayHeaders = useMemo(() => getWeekdayHeaders(), []);

  const weeks = useMemo(
    () =>
      buildFestivalWeeks({
        startDate: festivalStartDate,
        endDate: festivalEndDate,
        weekStartsOn: WEEK_STARTS_ON,
      }),
    [festivalStartDate, festivalEndDate],
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, number>();
    attendances.forEach((attendance) => {
      map.set(attendance.date, attendance.drinkCount);
    });
    return map;
  }, [attendances]);

  const planMap = useMemo(() => buildDayPlansByDate(plans), [plans]);

  const rangeLabel = useMemo(
    () =>
      `${formatLocalized(festivalStartDate, "MMM d")} – ${formatLocalized(
        festivalEndDate,
        "MMM d, yyyy",
      )}`,
    [festivalStartDate, festivalEndDate],
  );

  const renderDay = useCallback(
    (date: Date, isFirstOfMonth: boolean) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isToday = dateStr === todayKey;
      // A plan and who else is going only mean something ahead of time. A past
      // day shows what happened: attendance, and a reservation if one was made.
      const isUpcoming = dateStr >= todayKey;
      const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
      const drinkCount = attendanceMap.get(dateStr);
      const hasAttendance = drinkCount !== undefined;
      const plan = planMap.get(dateStr);
      const hasReservation = plan?.kind === "reservation";
      const hasPlan = plan?.kind === "plan" && isUpcoming;
      const friendsCount = isUpcoming ? (friendsCountByDate.get(dateStr) ?? 0) : 0;
      const topSlot = resolveCellTopSlot({ isToday, isFirstOfMonth });

      const cellClassName = cn(
        "h-14 flex-1 items-center justify-center rounded-lg",
        isSelected && "bg-primary-500",
        !isSelected && hasAttendance && "border border-primary-300 bg-primary-100",
        !isSelected && !hasAttendance && hasReservation && "border border-teal-300 bg-teal-100",
        !isSelected &&
          !hasAttendance &&
          !hasReservation &&
          hasPlan &&
          "border-2 border-dashed border-teal-400 bg-background-0",
        !isSelected && !hasAttendance && !hasReservation && !hasPlan && "bg-background-100",
      );

      const numberClassName = cn(
        "text-base font-semibold leading-tight",
        isSelected && "text-white",
        !isSelected && hasAttendance && "text-primary-700",
        !isSelected && !hasAttendance && (hasReservation || hasPlan) && "text-teal-700",
        !isSelected && !hasAttendance && !hasReservation && !hasPlan && "text-typography-900",
      );

      const indicatorColor = isSelected ? Colors.white : Colors.primary[600];

      const cellAccessibilityLabel = [
        formatLocalized(date, "EEEE, MMMM d"),
        isToday ? t("attendance.list.today") : null,
        hasAttendance ? t("attendance.drinkCount", { count: drinkCount }) : null,
        hasReservation ? t("attendance.list.reserved") : null,
        hasPlan ? t("attendance.calendar.a11yPlanning") : null,
        friendsCount > 0
          ? t("attendance.calendar.a11yFriendsGoing", { count: friendsCount })
          : null,
      ]
        .filter(Boolean)
        .join(", ");

      return (
        <Pressable
          key={dateStr}
          onPress={() => onDateSelect(date)}
          className={cellClassName}
          accessibilityRole="button"
          // Everything the cell conveys visually goes in the label: colour and
          // badges carry the drinks, the marks, today and the friends count.
          accessibilityLabel={cellAccessibilityLabel}
          accessibilityHint={t("attendance.calendar.tapToAddOrEdit")}
          accessibilityState={{ selected: isSelected }}
        >
          {friendsCount > 0 && (
            <View className="absolute -right-1 -top-1.5 z-10 h-4 min-w-4 items-center justify-center rounded-full border border-background-0 bg-sky-500 px-1">
              <Text className="text-[9px] font-bold leading-none text-white">
                {formatFriendsBadge(friendsCount)}
              </Text>
            </View>
          )}

          <VStack className="items-center">
            <View className="h-2 justify-center">
              {topSlot === "today" && (
                <Text
                  className={cn(
                    "text-[7px] font-extrabold uppercase leading-none",
                    isSelected ? "text-white" : "text-typography-900",
                  )}
                >
                  {t("attendance.list.today")}
                </Text>
              )}
              {topSlot === "month" && (
                <Text
                  className={cn(
                    "text-[8px] font-semibold uppercase leading-none",
                    isSelected ? "text-white" : "text-typography-500",
                  )}
                >
                  {formatLocalized(date, "MMM")}
                </Text>
              )}
            </View>

            <Text className={numberClassName}>{format(date, "d")}</Text>

            <HStack className="h-3 items-center gap-1">
              {drinkCount !== undefined && drinkCount > 0 && (
                <HStack className="items-center gap-0.5">
                  <Beer size={INDICATOR_ICON_SIZE} color={indicatorColor} />
                  <Text
                    className={cn(
                      "text-[9px] font-semibold leading-none",
                      isSelected ? "text-white" : "text-primary-600",
                    )}
                  >
                    {drinkCount}
                  </Text>
                </HStack>
              )}
              {hasReservation && (
                <CalendarClock
                  size={INDICATOR_ICON_SIZE}
                  color={isSelected ? Colors.white : IconColors.reservation}
                />
              )}
              {hasPlan && (
                <Footprints
                  size={INDICATOR_ICON_SIZE}
                  color={isSelected ? Colors.white : IconColors.plan}
                />
              )}
            </HStack>
          </VStack>
        </Pressable>
      );
    },
    [todayKey, selectedDate, attendanceMap, planMap, friendsCountByDate, onDateSelect, t],
  );

  return (
    <VStack className="rounded-xl bg-background-0 p-4">
      <Text className="mb-4 text-center text-lg font-semibold text-typography-900">
        {rangeLabel}
      </Text>

      <HStack className="mb-2 gap-1">
        {weekdayHeaders.map((weekday) => (
          <View key={weekday} className="flex-1 items-center">
            <Text className="text-xs font-medium text-typography-500">{weekday}</Text>
          </View>
        ))}
      </HStack>

      {/* space="sm" rather than xs: the friends badge sticks out above its cell
          and needs the gap to stay clear of the week above. */}
      <VStack space="sm">
        {weeks.map((week, weekIndex) => (
          <HStack key={weekIndex} className="gap-1">
            {week.map((cell, dayIndex) =>
              cell ? (
                renderDay(cell.date, cell.isFirstOfMonth)
              ) : (
                <View key={`blank-${weekIndex}-${dayIndex}`} className="h-14 flex-1" />
              ),
            )}
          </HStack>
        ))}
      </VStack>

      <HStack
        space="lg"
        className="mt-4 flex-wrap justify-center border-t border-background-200 pt-4"
      >
        <HStack space="sm" className="items-center">
          <View className="h-3 w-3 rounded border border-primary-300 bg-primary-100" />
          <Text className="text-xs text-typography-500">
            {t("attendance.calendar.hasAttendance")}
          </Text>
        </HStack>
        <HStack space="sm" className="items-center">
          <View className="h-3 w-3 rounded border border-teal-300 bg-teal-100" />
          <Text className="text-xs text-typography-500">
            {t("attendance.calendar.hasReservation")}
          </Text>
        </HStack>
        <HStack space="sm" className="items-center">
          <View className="h-3 w-3 rounded border border-dashed border-teal-400 bg-background-0" />
          <Text className="text-xs text-typography-500">{t("attendance.calendar.hasPlan")}</Text>
        </HStack>
        <HStack space="sm" className="items-center">
          <View className="h-3 w-3 rounded-full bg-sky-500" />
          <Text className="text-xs text-typography-500">
            {t("attendance.calendar.friendsGoing")}
          </Text>
        </HStack>
        <HStack space="sm" className="items-center">
          <View className="h-3 w-3 rounded bg-primary-500" />
          <Text className="text-xs text-typography-500">{t("attendance.calendar.selected")}</Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

AttendanceStrip.displayName = "AttendanceStrip";
