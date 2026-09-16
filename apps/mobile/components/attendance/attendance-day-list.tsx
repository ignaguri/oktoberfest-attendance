import { useTranslation } from "@prostcounter/shared/i18n";
import type { AttendanceWithTotals, DayPlan } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { format, isSameDay, parseISO } from "date-fns";
import { CalendarClock, Footprints, Image as ImageIcon, Users } from "lucide-react-native";
import { Fragment, useMemo } from "react";

import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  buildDayListEntries,
  type DayListEntry,
  formatEuros,
} from "@/lib/attendance/day-list-entries";
import { buildDayPlansByDate } from "@/lib/attendance/day-plans";
import { IconColors } from "@/lib/constants/colors";
import type { DaySummaries } from "@/lib/database/adapted-hooks";

import { DrinkCountSummary } from "./drink-count-summary";

/** Names shown inline before the row collapses the rest into "+N". */
const MAX_VISIBLE_TENTS = 2;

const NO_FRIENDS = new Map<string, number>();

interface AttendanceDayListProps {
  attendances: AttendanceWithTotals[];
  summaries: DaySummaries | null;
  /** The user's own marks, both kinds. */
  plans?: DayPlan[];
  /**
   * Plans could not be loaded, so plan-only and reservation-only rows are missing.
   *
   * Worth saying out loud: this list is the one view whose row *set* depends on
   * plan data, and plans are API-only, so offline it is simply shorter with no
   * explanation. Silence reads as days having been lost.
   */
  plansUnavailable?: boolean;
  /** How many friends have a visible plan or reservation, per YYYY-MM-DD. */
  friendsCountByDate?: Map<string, number>;
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

function FriendsChip({ count }: { count: number }) {
  const { t } = useTranslation();

  return (
    <HStack space="xs" className="items-center rounded-full bg-sky-100 px-2 py-0.5">
      <Users size={12} color={IconColors.friends} />
      <Text className="text-xs font-medium text-sky-700">
        {t("attendance.list.friendsCount", { count })}
      </Text>
    </HStack>
  );
}

/**
 * List of days that have an attendance record, a plan or an active reservation,
 * most recent first.
 *
 * Complements the strip: the strip shows which days exist and is where you plan
 * and log, the list shows what each logged day actually cost and where it
 * happened. Plan-only and reservation-only days render as lightweight rows, and
 * upcoming rows say how many friends are going.
 */
export function AttendanceDayList({
  attendances,
  summaries,
  plans = [],
  plansUnavailable = false,
  friendsCountByDate = NO_FRIENDS,
  summariesLoading = false,
  selectedDate,
  onDateSelect,
}: AttendanceDayListProps) {
  const { t } = useTranslation();
  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  function handlePress(dateStr: string) {
    onDateSelect(parseISO(dateStr));
  }

  const planMap = useMemo(() => buildDayPlansByDate(plans), [plans]);

  const entries = useMemo(
    () => buildDayListEntries(attendances, planMap, todayKey),
    [attendances, planMap, todayKey],
  );

  // A refetch keeps the previous summaries, and showing placeholders over data
  // the row can already display would be a step backwards.
  const showSummarySkeleton = summariesLoading && summaries === null;

  // Sits above the rows and inside the empty state, because a list that is merely
  // shorter than usual is the case that misleads: the user cannot tell a day they
  // never logged from a plan row that failed to load.
  const plansNotice = plansUnavailable ? (
    <HStack space="xs" className="items-center justify-center px-3 py-2">
      <CalendarClock size={14} color={IconColors.muted} />
      <Text className="text-xs text-typography-500">{t("attendance.list.plansUnavailable")}</Text>
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
        {plansNotice}
      </VStack>
    );
  }

  /** Friends only matter for days still ahead. */
  function upcomingFriendsCount(dateStr: string): number {
    return dateStr >= todayKey ? (friendsCountByDate.get(dateStr) ?? 0) : 0;
  }

  function renderEntry(entry: DayListEntry) {
    const date = parseISO(entry.date);
    const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
    const friendsCount = upcomingFriendsCount(entry.date);

    if (entry.kind === "planOnly") {
      const { plan } = entry;

      const accessibilityLabelParts = [
        formatLocalized(date, "EEEE, MMMM d"),
        t("attendance.list.planning"),
      ];
      if (plan.tentName) {
        accessibilityLabelParts.push(plan.tentName);
      }
      if (plan.note) {
        accessibilityLabelParts.push(plan.note);
      }
      if (friendsCount > 0) {
        accessibilityLabelParts.push(t("attendance.list.friendsCount", { count: friendsCount }));
      }

      return (
        <Pressable
          onPress={() => handlePress(entry.date)}
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
              <HStack space="xs" className="items-center">
                <Footprints size={14} color={IconColors.plan} />
                <Text className="text-sm text-teal-700">{t("attendance.list.planning")}</Text>
                {plan.tentName && (
                  <Text className="text-sm text-typography-500" numberOfLines={1}>
                    {plan.tentName}
                  </Text>
                )}
              </HStack>
            </HStack>
            {(plan.note || friendsCount > 0) && (
              <HStack space="sm" className="items-center justify-between">
                <Text className="flex-1 text-xs italic text-typography-500" numberOfLines={1}>
                  {plan.note ?? ""}
                </Text>
                {friendsCount > 0 && <FriendsChip count={friendsCount} />}
              </HStack>
            )}
          </VStack>
        </Pressable>
      );
    }

    if (entry.kind === "reservationOnly") {
      const { reservation } = entry;

      const accessibilityLabelParts = [
        formatLocalized(date, "EEEE, MMMM d"),
        t("attendance.list.reserved"),
      ];
      if (reservation.tentName) {
        accessibilityLabelParts.push(reservation.tentName);
      }
      if (friendsCount > 0) {
        accessibilityLabelParts.push(t("attendance.list.friendsCount", { count: friendsCount }));
      }

      return (
        <Pressable
          onPress={() => handlePress(entry.date)}
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
              <HStack space="xs" className="items-center">
                <CalendarClock size={14} color={IconColors.reservation} />
                <Text className="text-sm text-teal-700">{t("attendance.list.reserved")}</Text>
                {reservation.tentName && (
                  <Text className="text-sm text-typography-500">{reservation.tentName}</Text>
                )}
              </HStack>
            </HStack>
            {friendsCount > 0 && (
              <HStack className="justify-end">
                <FriendsChip count={friendsCount} />
              </HStack>
            )}
          </VStack>
        </Pressable>
      );
    }

    const { attendance } = entry;
    const tentNames = summaries?.tentNames.get(attendance.date) ?? [];
    const drinkCounts = summaries?.drinkCounts.get(attendance.date);
    const photoCount = summaries?.photoCounts.get(attendance.date) ?? 0;
    const hasReservation = planMap.get(attendance.date)?.kind === "reservation";

    const visibleTents = tentNames.slice(0, MAX_VISIBLE_TENTS);
    const hiddenTentCount = tentNames.length - visibleTents.length;

    // Everything the row shows, including the bare icons: a reservation and a
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
    if (friendsCount > 0) {
      accessibilityLabelParts.push(t("attendance.list.friendsCount", { count: friendsCount }));
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

          {friendsCount > 0 && (
            <HStack className="justify-end">
              <FriendsChip count={friendsCount} />
            </HStack>
          )}
        </VStack>
      </Pressable>
    );
  }

  return (
    <VStack space="xs" className="rounded-xl bg-background-0 p-2">
      {plansNotice}
      {entries.map((entry, index) => (
        <Fragment key={entry.date}>
          {index > 0 && <Divider />}
          {renderEntry(entry)}
        </Fragment>
      ))}
    </VStack>
  );
}
