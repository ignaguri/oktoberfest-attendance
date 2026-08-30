import { useTranslation } from "@prostcounter/shared/i18n";
import type { AttendanceWithTotals, Reservation } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { isSameDay, parseISO } from "date-fns";
import { CalendarClock, Image as ImageIcon } from "lucide-react-native";
import { Fragment, useMemo } from "react";

import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import type { DaySummaries } from "@/lib/database/adapted-hooks";
import {
  buildActiveReservationsByDate,
  buildDayListEntries,
  type DayListEntry,
  formatEuros,
} from "@/lib/attendance/day-list-entries";

import { DrinkCountSummary } from "./drink-count-summary";

/** Names shown inline before the row collapses the rest into "+N". */
const MAX_VISIBLE_TENTS = 2;

interface AttendanceDayListProps {
  attendances: AttendanceWithTotals[];
  summaries: DaySummaries | null;
  reservations?: Reservation[];
  /**
   * Reservations could not be loaded, so reservation-only rows are missing.
   *
   * Worth saying out loud: this list is the one view whose row *set* depends on
   * reservation data, and reservations are API-only, so offline it is simply
   * shorter with no explanation. Silence reads as days having been lost.
   */
  reservationsUnavailable?: boolean;
  /**
   * Day summaries are still being read from SQLite.
   *
   * The rows themselves come from `attendances` and render immediately, so this
   * only covers the two pieces that arrive later. Both are the row's own height:
   * without a placeholder each row grows by two lines a frame after it appears,
   * shoving the rest of the list down under the reader's thumb.
   */
  summariesLoading?: boolean;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

/**
 * List of days that have an attendance record or an active reservation, most
 * recent first.
 *
 * Complements the strip: the strip shows which days exist and is where you plan
 * and log, the list shows what each logged day actually cost and where it
 * happened — detail a 48pt cell cannot carry. Reservation-only days (an active
 * reservation with no attendance yet) render as a lightweight row so this view
 * doesn't hide reservations the way the calendar strip does not.
 */
export function AttendanceDayList({
  attendances,
  summaries,
  reservations = [],
  reservationsUnavailable = false,
  summariesLoading = false,
  selectedDate,
  onDateSelect,
}: AttendanceDayListProps) {
  const { t } = useTranslation();

  function handlePress(dateStr: string) {
    onDateSelect(parseISO(dateStr));
  }

  const reservationMap = useMemo(() => buildActiveReservationsByDate(reservations), [reservations]);

  const entries = useMemo(
    () => buildDayListEntries(attendances, reservationMap),
    [attendances, reservationMap],
  );

  // A refetch keeps the previous summaries, and showing placeholders over data
  // the row can already display would be a step backwards.
  const showSummarySkeleton = summariesLoading && summaries === null;

  // Sits above the rows and inside the empty state, because a list that is merely
  // shorter than usual is the case that misleads: the user cannot tell a day they
  // never logged from a reservation row that failed to load.
  const reservationNotice = reservationsUnavailable ? (
    <HStack space="xs" className="items-center justify-center px-3 py-2">
      <CalendarClock size={14} color={IconColors.muted} />
      <Text className="text-xs text-typography-500">
        {t("attendance.list.reservationsUnavailable")}
      </Text>
    </HStack>
  ) : null;

  if (entries.length === 0) {
    return (
      <VStack space="xs" className="items-center rounded-xl bg-background-0 p-8">
        <Text className="text-center font-medium text-typography-700">
          {t("attendance.noAttendances")}
        </Text>
        <Text className="text-center text-sm text-typography-500">
          {t("attendance.noAttendancesDescription")}
        </Text>
        {reservationNotice}
      </VStack>
    );
  }

  function renderEntry(entry: DayListEntry) {
    if (entry.kind === "reservationOnly") {
      const date = parseISO(entry.date);
      const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
      const { reservation } = entry;

      const accessibilityLabelParts = [
        formatLocalized(date, "EEEE, MMMM d"),
        t("attendance.list.reserved"),
      ];
      if (reservation.tentName) {
        accessibilityLabelParts.push(reservation.tentName);
      }

      return (
        <Pressable
          onPress={() => handlePress(entry.date)}
          className={cn("rounded-lg p-3", isSelected ? "bg-primary-100" : "bg-transparent")}
          accessibilityLabel={accessibilityLabelParts.join(", ")}
          accessibilityHint={t("attendance.calendar.tapToAddOrEdit")}
        >
          <HStack className="items-center justify-between">
            <Text className="font-medium text-typography-900">
              {formatLocalized(date, "EEE, MMM d")}
            </Text>
            <HStack space="xs" className="items-center">
              <CalendarClock size={14} color={IconColors.reservation} />
              <Text className="text-sm text-teal-700">{t("attendance.list.reserved")}</Text>
              {reservation.tentName && (
                <Text className="text-sm text-typography-500">{reservation.tentName}</Text>
              )}
            </HStack>
          </HStack>
        </Pressable>
      );
    }

    const { attendance } = entry;
    const date = parseISO(attendance.date);
    const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
    const tentNames = summaries?.tentNames.get(attendance.date) ?? [];
    const drinkCounts = summaries?.drinkCounts.get(attendance.date);
    const photoCount = summaries?.photoCounts.get(attendance.date) ?? 0;
    const hasReservation = reservationMap.has(attendance.date);

    const visibleTents = tentNames.slice(0, MAX_VISIBLE_TENTS);
    const hiddenTentCount = tentNames.length - visibleTents.length;

    // Everything the row shows, including the two bare icons: a reservation and a
    // photo are rendered as glyphs with no text anywhere near them, so leaving
    // them out made them invisible to a screen reader.
    // drinkCount rather than a dedicated string, because it is already pluralized
    // in all three locales - the old key said "1 drinks".
    const accessibilityLabelParts = [
      formatLocalized(date, "EEEE, MMMM d"),
      t("attendance.list.a11ySpent", { amount: formatEuros(attendance.totalSpentCents) }),
      t("attendance.drinkCount", { count: attendance.drinkCount }),
    ];
    if (attendance.totalTipCents > 0) {
      accessibilityLabelParts.push(
        t("attendance.list.tip", { amount: formatEuros(attendance.totalTipCents) }),
      );
    }
    if (hasReservation) {
      accessibilityLabelParts.push(t("attendance.list.reserved"));
    }
    if (photoCount > 0) {
      accessibilityLabelParts.push(t("attendance.list.a11yPhotos", { count: photoCount }));
    }
    if (tentNames.length > 0) {
      accessibilityLabelParts.push(tentNames.join(", "));
    }

    return (
      <Pressable
        onPress={() => handlePress(attendance.date)}
        className={cn("rounded-lg p-3", isSelected ? "bg-primary-100" : "bg-transparent")}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabelParts.join(", ")}
        accessibilityHint={t("attendance.calendar.tapToAddOrEdit")}
        accessibilityState={{ selected: isSelected }}
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
            {/* h-4 matches the 14pt icon + text-xs count the real chips render at,
                so the swap does not change this row's height. */}
            {showSummarySkeleton ? (
              <HStack space="md" className="items-center">
                <Skeleton variant="rounded" className="h-4 w-10" />
                <Skeleton variant="rounded" className="h-4 w-10" />
              </HStack>
            ) : (
              <DrinkCountSummary counts={drinkCounts} compact showTotal={false} />
            )}

            <HStack space="sm" className="items-center">
              {attendance.totalTipCents > 0 && (
                <Text className="text-xs text-success-600">
                  {t("attendance.list.tip", {
                    amount: formatEuros(attendance.totalTipCents),
                  })}
                </Text>
              )}
              {hasReservation && <CalendarClock size={14} color={IconColors.reservation} />}
              {photoCount > 0 && <ImageIcon size={14} color={IconColors.muted} />}
            </HStack>
          </HStack>

          {showSummarySkeleton && (
            <HStack space="xs" className="items-center">
              <Skeleton variant="rounded" className="h-4 w-32" />
            </HStack>
          )}

          {!showSummarySkeleton && visibleTents.length > 0 && (
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
  }

  return (
    <VStack space="xs" className="rounded-xl bg-background-0 p-2">
      {reservationNotice}
      {entries.map((entry, index) => (
        <Fragment key={entry.date}>
          {index > 0 && <Divider />}
          {renderEntry(entry)}
        </Fragment>
      ))}
    </VStack>
  );
}

AttendanceDayList.displayName = "AttendanceDayList";
