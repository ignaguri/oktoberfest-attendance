import { useTranslation } from "@prostcounter/shared/i18n";
import type { Reservation } from "@prostcounter/shared/schemas";
import { buildFestivalWeeks, formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { addDays, format, isSameDay } from "date-fns";
import { Beer, CalendarClock } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { buildActiveReservationsByDate } from "@/lib/attendance/day-list-entries";

interface AttendanceData {
  date: string;
  drinkCount: number;
}

interface AttendanceStripProps {
  festivalStartDate: Date;
  festivalEndDate: Date;
  attendances: AttendanceData[];
  reservations?: Reservation[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

// Week starts on Monday (ISO standard, used in Europe)
const WEEK_STARTS_ON = 1 as const;

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
 * Replaces the previous month grid, which could open on a month containing zero
 * festival days and which split every month-straddling festival (5 of 6 in
 * production) across two screens.
 */
export function AttendanceStrip({
  festivalStartDate,
  festivalEndDate,
  attendances,
  reservations = [],
  selectedDate,
  onDateSelect,
}: AttendanceStripProps) {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
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

  // Shared with the day list: both views need the same one-reservation-per-day
  // map, and two copies of it would drift.
  const reservationMap = useMemo(
    () => buildActiveReservationsByDate(reservations),
    [reservations],
  );

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
      const isToday = isSameDay(date, today);
      const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
      const drinkCount = attendanceMap.get(dateStr);
      const hasAttendance = drinkCount !== undefined;
      const hasReservation = reservationMap.has(dateStr);

      const cellClassName = cn(
        "h-12 w-12 items-center justify-center rounded-lg",
        isSelected && "bg-primary-500",
        !isSelected && hasAttendance && "bg-primary-100 border border-primary-300",
        !isSelected && !hasAttendance && hasReservation && "bg-teal-100 border border-teal-300",
        !isSelected && !hasAttendance && !hasReservation && "bg-background-100",
      );

      const textClassName = cn(
        "text-sm font-medium",
        isSelected && "text-white",
        !isSelected && hasAttendance && "text-primary-700",
        !isSelected && !hasAttendance && hasReservation && "text-teal-700",
        !isSelected && !hasAttendance && !hasReservation && "text-typography-900",
      );

      const indicatorColor = isSelected ? Colors.white : Colors.primary[600];

      const cellAccessibilityLabel = [
        formatLocalized(date, "EEEE, MMMM d"),
        isToday ? t("attendance.list.today") : null,
        hasAttendance ? t("attendance.drinkCount", { count: drinkCount }) : null,
        hasReservation ? t("attendance.list.reserved") : null,
      ]
        .filter(Boolean)
        .join(", ");

      return (
        <Pressable
          key={dateStr}
          onPress={() => onDateSelect(date)}
          className={cellClassName}
          accessibilityRole="button"
          // Everything the cell conveys visually goes in the label. Colour and a
          // badge carry the drink count, the reservation and today, and a label of
          // only the date left a screen-reader user swiping past sixteen
          // indistinguishable days with no way to tell which ones they had logged
          // - on the view that opens by default.
          accessibilityLabel={cellAccessibilityLabel}
          accessibilityHint={t("attendance.calendar.tapToAddOrEdit")}
          accessibilityState={{ selected: isSelected }}
        >
          <VStack className="items-center">
            {isToday && <View className="absolute -top-0.5 h-1 w-3 rounded-full bg-primary-800" />}

            {isFirstOfMonth && (
              <Text
                className={cn(
                  "text-[9px] font-semibold uppercase",
                  isSelected ? "text-white" : "text-typography-500",
                )}
              >
                {formatLocalized(date, "MMM")}
              </Text>
            )}

            <Text className={textClassName}>{format(date, "d")}</Text>

            {/* Both indicators render when both exist; the previous calendar
                suppressed the reservation whenever the day also had attendance. */}
            {(hasAttendance || hasReservation) && (
              <HStack className="mt-0.5 items-center gap-1">
                {drinkCount !== undefined && drinkCount > 0 && (
                  <HStack className="items-center gap-0.5">
                    <Beer size={10} color={indicatorColor} />
                    <Text
                      className={cn(
                        "text-[10px] font-semibold",
                        isSelected ? "text-white" : "text-primary-600",
                      )}
                    >
                      {drinkCount}
                    </Text>
                  </HStack>
                )}
                {hasReservation && (
                  <CalendarClock
                    size={12}
                    color={isSelected ? Colors.white : IconColors.reservation}
                  />
                )}
              </HStack>
            )}
          </VStack>
        </Pressable>
      );
    },
    [today, selectedDate, attendanceMap, reservationMap, onDateSelect, t],
  );

  return (
    <VStack className="rounded-xl bg-background-0 p-4">
      <Text className="mb-4 text-center text-lg font-semibold text-typography-900">
        {rangeLabel}
      </Text>

      <HStack className="mb-2 justify-around">
        {weekdayHeaders.map((weekday) => (
          <View key={weekday} className="w-12 items-center">
            <Text className="text-xs font-medium text-typography-500">{weekday}</Text>
          </View>
        ))}
      </HStack>

      <VStack space="xs">
        {weeks.map((week, weekIndex) => (
          <HStack key={weekIndex} className="justify-around">
            {week.map((cell, dayIndex) =>
              cell ? (
                renderDay(cell.date, cell.isFirstOfMonth)
              ) : (
                <View key={`blank-${weekIndex}-${dayIndex}`} className="h-12 w-12" />
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
          <View className="h-3 w-3 rounded bg-primary-500" />
          <Text className="text-xs text-typography-500">{t("attendance.calendar.selected")}</Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

AttendanceStrip.displayName = "AttendanceStrip";
