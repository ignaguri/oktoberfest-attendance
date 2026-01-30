import { useTranslation } from "@prostcounter/shared/i18n";
import type { Reservation } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Beer,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { isActiveReservation } from "@/lib/utils/reservation";

interface AttendanceData {
  date: string;
  drinkCount: number;
}

interface AttendanceCalendarProps {
  festivalStartDate: Date;
  festivalEndDate: Date;
  attendances: AttendanceData[];
  reservations?: Reservation[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

// Week starts on Monday (ISO standard, used in Europe)
const WEEK_STARTS_ON = 1 as const; // 0 = Sunday, 1 = Monday

// Generate weekday headers dynamically based on WEEK_STARTS_ON
// This ensures the headers always match the calendar grid
const getWeekdayHeaders = () => {
  // Use a reference Monday to generate the week
  const referenceMonday = new Date(2024, 0, 1); // Jan 1, 2024 is a Monday
  const weekStart = startOfWeek(referenceMonday, {
    weekStartsOn: WEEK_STARTS_ON,
  });
  return Array.from({ length: 7 }, (_, i) =>
    formatLocalized(addDays(weekStart, i), "EEE"),
  );
};

/**
 * Calendar view showing festival days with attendance indicators
 *
 * Features:
 * - Shows calendar grid for festival months
 * - Festival days are highlighted and interactive
 * - Days with attendance show beer count badge
 * - Navigation constrained to festival period
 * - Today indicator
 */
export function AttendanceCalendar({
  festivalStartDate,
  festivalEndDate,
  attendances,
  reservations = [],
  selectedDate,
  onDateSelect,
}: AttendanceCalendarProps) {
  const { t } = useTranslation();

  // Current displayed month (starts at festival start month)
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(festivalStartDate),
  );

  const today = useMemo(() => new Date(), []);

  // Generate weekday headers - memoized since it's static
  const weekdayHeaders = useMemo(() => getWeekdayHeaders(), []);

  // Map of date string -> drink count for quick lookup
  const attendanceMap = useMemo(() => {
    const map = new Map<string, number>();
    attendances.forEach((a) => {
      map.set(a.date, a.drinkCount);
    });
    return map;
  }, [attendances]);

  // Map of date string -> reservation for quick lookup (only active reservations)
  const reservationMap = useMemo(() => {
    const map = new Map<string, Reservation>();
    reservations.filter(isActiveReservation).forEach((r) => {
      const dateStr = format(new Date(r.startAt), "yyyy-MM-dd");
      map.set(dateStr, r);
    });
    return map;
  }, [reservations]);

  // Check if we can navigate to prev/next month
  const canGoPrev = useMemo(() => {
    const prevMonth = subMonths(currentMonth, 1);
    return !isBefore(endOfMonth(prevMonth), startOfMonth(festivalStartDate));
  }, [currentMonth, festivalStartDate]);

  const canGoNext = useMemo(() => {
    const nextMonth = addMonths(currentMonth, 1);
    return !isAfter(startOfMonth(nextMonth), endOfMonth(festivalEndDate));
  }, [currentMonth, festivalEndDate]);

  // Generate days for the calendar grid, organized by weeks
  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, {
      weekStartsOn: WEEK_STARTS_ON,
    });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Split into weeks (7 days each) for proper grid alignment
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonth]);

  const handlePrevMonth = useCallback(() => {
    if (canGoPrev) {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  }, [canGoPrev]);

  const handleNextMonth = useCallback(() => {
    if (canGoNext) {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  }, [canGoNext]);

  const handleDayPress = useCallback(
    (day: Date) => {
      const isFestivalDay = isWithinInterval(day, {
        start: festivalStartDate,
        end: festivalEndDate,
      });
      if (isFestivalDay) {
        onDateSelect(day);
      }
    },
    [festivalStartDate, festivalEndDate, onDateSelect],
  );

  const renderDay = useCallback(
    (day: Date, index: number) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isCurrentMonth = isSameMonth(day, currentMonth);
      const isToday = isSameDay(day, today);
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isFestivalDay = isWithinInterval(day, {
        start: festivalStartDate,
        end: festivalEndDate,
      });
      const drinkCount = attendanceMap.get(dateStr);
      const hasAttendance = drinkCount !== undefined;
      const hasReservation = reservationMap.has(dateStr);

      // Determine cell styling using cn() for safe class merging
      // Festival days from adjacent months should be fully interactive and styled
      const cellClassName = cn(
        "h-12 w-12 items-center justify-center rounded-lg",
        // Non-festival days outside current month - faded
        !isCurrentMonth && !isFestivalDay && "opacity-30",
        // Selected festival day (any month)
        isFestivalDay && isSelected && "bg-primary-500",
        // Festival day with attendance (not selected)
        isFestivalDay &&
          !isSelected &&
          hasAttendance &&
          "bg-primary-100 border border-primary-300",
        // Festival day with reservation only (not selected, no attendance)
        isFestivalDay &&
          !isSelected &&
          !hasAttendance &&
          hasReservation &&
          "bg-teal-100 border border-teal-300",
        // Festival day without attendance or reservation (not selected)
        isFestivalDay &&
          !isSelected &&
          !hasAttendance &&
          !hasReservation &&
          "bg-background-100",
      );

      const textClassName = cn(
        "text-sm font-medium",
        // Non-festival days outside current month - faded text
        !isCurrentMonth && !isFestivalDay && "text-typography-400",
        // Non-festival days in current month - slightly faded
        isCurrentMonth && !isFestivalDay && "text-typography-300",
        // Festival day selected (any month)
        isFestivalDay && isSelected && "text-white",
        // Festival day with attendance (not selected)
        isFestivalDay && !isSelected && hasAttendance && "text-primary-700",
        // Festival day with reservation only (not selected)
        isFestivalDay &&
          !isSelected &&
          !hasAttendance &&
          hasReservation &&
          "text-teal-700",
        // Festival day without attendance or reservation (not selected)
        isFestivalDay &&
          !isSelected &&
          !hasAttendance &&
          !hasReservation &&
          "text-typography-900",
      );

      return (
        <Pressable
          key={index}
          onPress={() => handleDayPress(day)}
          disabled={!isFestivalDay}
          className={cellClassName}
        >
          <VStack className="items-center">
            {/* Today indicator */}
            {isToday && (
              <View className="absolute -top-0.5 h-1 w-3 rounded-full bg-primary-800" />
            )}

            {/* Day number */}
            <Text className={textClassName}>{format(day, "d")}</Text>

            {/* Indicators row - show both if applicable */}
            {isFestivalDay &&
              !isSelected &&
              (hasAttendance || hasReservation) && (
                <HStack className="mt-0.5 items-center gap-1">
                  {/* Beer count badge - only show if drinkCount > 0 */}
                  {hasAttendance && drinkCount! > 0 && (
                    <HStack className="items-center gap-0.5">
                      <Beer size={10} color={Colors.primary[600]} />
                      <Text className="text-[10px] font-semibold text-primary-600">
                        {drinkCount}
                      </Text>
                    </HStack>
                  )}
                  {/* Reservation indicator */}
                  {hasReservation && !hasAttendance && (
                    <CalendarClock size={12} color={IconColors.reservation} />
                  )}
                </HStack>
              )}

            {/* Indicators on selected */}
            {isSelected && (hasAttendance || hasReservation) && (
              <HStack className="mt-0.5 items-center gap-1">
                {hasAttendance && drinkCount! > 0 && (
                  <HStack className="items-center gap-0.5">
                    <Beer size={10} color={Colors.white} />
                    <Text className="text-[10px] font-semibold text-white">
                      {drinkCount}
                    </Text>
                  </HStack>
                )}
                {hasReservation && !hasAttendance && (
                  <CalendarClock size={12} color={Colors.white} />
                )}
              </HStack>
            )}
          </VStack>
        </Pressable>
      );
    },
    [
      currentMonth,
      today,
      selectedDate,
      festivalStartDate,
      festivalEndDate,
      attendanceMap,
      reservationMap,
      handleDayPress,
    ],
  );

  return (
    <VStack className="rounded-xl bg-background-0 p-4">
      {/* Header with month navigation */}
      <HStack className="mb-4 items-center justify-between">
        <Pressable
          onPress={handlePrevMonth}
          disabled={!canGoPrev}
          className="p-2"
        >
          <ChevronLeft
            size={24}
            color={canGoPrev ? IconColors.default : IconColors.disabled}
          />
        </Pressable>

        <Text className="text-lg font-semibold text-typography-900">
          {formatLocalized(currentMonth, "MMMM yyyy")}
        </Text>

        <Pressable
          onPress={handleNextMonth}
          disabled={!canGoNext}
          className="p-2"
        >
          <ChevronRight
            size={24}
            color={canGoNext ? IconColors.default : IconColors.disabled}
          />
        </Pressable>
      </HStack>

      {/* Weekday headers */}
      <HStack className="mb-2 justify-around">
        {weekdayHeaders.map((day) => (
          <View key={day} className="w-12 items-center">
            <Text className="text-xs font-medium text-typography-500">
              {day}
            </Text>
          </View>
        ))}
      </HStack>

      {/* Calendar grid - render week by week for proper alignment */}
      <VStack space="xs">
        {calendarWeeks.map((week, weekIndex) => (
          <HStack key={weekIndex} className="justify-around">
            {week.map((day, dayIndex) =>
              renderDay(day, weekIndex * 7 + dayIndex),
            )}
          </HStack>
        ))}
      </VStack>

      {/* Legend */}
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
          <Text className="text-xs text-typography-500">
            {t("attendance.calendar.selected")}
          </Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

AttendanceCalendar.displayName = "AttendanceCalendar";
