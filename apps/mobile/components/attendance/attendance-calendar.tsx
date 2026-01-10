import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { ChevronLeft, ChevronRight, Beer } from "lucide-react-native";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
} from "date-fns";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors, Colors } from "@/lib/constants/colors";

interface AttendanceData {
  date: string;
  beerCount: number;
}

interface AttendanceCalendarProps {
  festivalStartDate: Date;
  festivalEndDate: Date;
  attendances: AttendanceData[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  selectedDate,
  onDateSelect,
}: AttendanceCalendarProps) {
  // Current displayed month (starts at festival start month)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(festivalStartDate));

  const today = useMemo(() => new Date(), []);

  // Map of date string -> beer count for quick lookup
  const attendanceMap = useMemo(() => {
    const map = new Map<string, number>();
    attendances.forEach((a) => {
      map.set(a.date, a.beerCount);
    });
    return map;
  }, [attendances]);

  // Check if we can navigate to prev/next month
  const canGoPrev = useMemo(() => {
    const prevMonth = subMonths(currentMonth, 1);
    return !isBefore(endOfMonth(prevMonth), startOfMonth(festivalStartDate));
  }, [currentMonth, festivalStartDate]);

  const canGoNext = useMemo(() => {
    const nextMonth = addMonths(currentMonth, 1);
    return !isAfter(startOfMonth(nextMonth), endOfMonth(festivalEndDate));
  }, [currentMonth, festivalEndDate]);

  // Generate days for the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
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
    [festivalStartDate, festivalEndDate, onDateSelect]
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
      const beerCount = attendanceMap.get(dateStr);
      const hasAttendance = beerCount !== undefined && beerCount > 0;

      // Determine cell styling
      let cellClassName = "h-12 w-12 items-center justify-center rounded-lg ";
      let textClassName = "text-sm font-medium ";

      if (!isCurrentMonth) {
        // Outside current month
        cellClassName += "opacity-30";
        textClassName += "text-typography-400";
      } else if (!isFestivalDay) {
        // Not a festival day
        textClassName += "text-typography-300";
      } else if (isSelected) {
        // Selected festival day
        cellClassName += "bg-primary-500";
        textClassName += "text-white";
      } else if (hasAttendance) {
        // Festival day with attendance
        cellClassName += "bg-primary-100 border border-primary-300";
        textClassName += "text-primary-700";
      } else {
        // Festival day without attendance
        cellClassName += "bg-background-100";
        textClassName += "text-typography-900";
      }

      return (
        <Pressable
          key={index}
          onPress={() => handleDayPress(day)}
          disabled={!isFestivalDay || !isCurrentMonth}
          className={cellClassName}
        >
          <VStack className="items-center">
            {/* Today indicator */}
            {isToday && (
              <View className="absolute -top-0.5 h-1 w-1 rounded-full bg-error-500" />
            )}

            {/* Day number */}
            <Text className={textClassName}>{format(day, "d")}</Text>

            {/* Beer count badge */}
            {hasAttendance && isFestivalDay && isCurrentMonth && !isSelected && (
              <HStack className="items-center gap-0.5 mt-0.5">
                <Beer size={10} color={Colors.primary[600]} />
                <Text className="text-[10px] font-semibold text-primary-600">
                  {beerCount}
                </Text>
              </HStack>
            )}

            {/* Beer count on selected */}
            {hasAttendance && isSelected && (
              <HStack className="items-center gap-0.5 mt-0.5">
                <Beer size={10} color={Colors.white} />
                <Text className="text-[10px] font-semibold text-white">
                  {beerCount}
                </Text>
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
      handleDayPress,
    ]
  );

  return (
    <VStack className="bg-background-0 rounded-xl p-4">
      {/* Header with month navigation */}
      <HStack className="items-center justify-between mb-4">
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
          {format(currentMonth, "MMMM yyyy")}
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
      <HStack className="justify-around mb-2">
        {WEEKDAYS.map((day) => (
          <View key={day} className="w-12 items-center">
            <Text className="text-xs font-medium text-typography-500">
              {day}
            </Text>
          </View>
        ))}
      </HStack>

      {/* Calendar grid */}
      <View className="flex-row flex-wrap justify-around">
        {calendarDays.map((day, index) => renderDay(day, index))}
      </View>

      {/* Legend */}
      <HStack className="justify-center gap-6 mt-4 pt-4 border-t border-background-200">
        <HStack className="items-center gap-2">
          <View className="h-3 w-3 rounded bg-primary-100 border border-primary-300" />
          <Text className="text-xs text-typography-500">Has attendance</Text>
        </HStack>
        <HStack className="items-center gap-2">
          <View className="h-3 w-3 rounded bg-primary-500" />
          <Text className="text-xs text-typography-500">Selected</Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

AttendanceCalendar.displayName = "AttendanceCalendar";
