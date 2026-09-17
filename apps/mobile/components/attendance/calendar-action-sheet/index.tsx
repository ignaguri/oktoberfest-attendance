import { TIMEZONE } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  AttendanceWithTotals,
  DayPlan,
  FriendGoing,
  Reservation,
} from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { format } from "date-fns";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl, type Tab } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { classifyFestivalDay } from "@/lib/attendance/day-plans";
import { IconColors } from "@/lib/constants/colors";

import { DayPlanner } from "../day-planner";
import { type AttendanceSuccessData, AttendanceTabContent } from "./attendance-tab-content";
import { ReservationTabContent } from "./reservation-tab-content";

export type TabKey = "attendance" | "reservation" | "plan";

export interface CalendarActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  /** The festival's timezone, for today's date and reservation times. */
  festivalTimezone?: string | null;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceWithTotals | null;
  /** The day's active reservation, shown read-only on a past day. */
  existingReservation?: Reservation | null;
  /** The user's plan or reservation for the day, edited in the planner. */
  existingPlan?: DayPlan | null;
  /**
   * False when the day's reservation was already checked in or expired: the
   * API refuses to replace it, so the planner would only ever fail to save.
   */
  canPlan?: boolean;
  /** Friends with a visible plan or reservation on the day. */
  friends?: FriendGoing[];
  onSuccess?: (data: AttendanceSuccessData) => void;
  // Check-in mode: pre-fill tent from reservation
  checkInMode?: boolean;
  prefillTentId?: string;
}

const NO_FRIENDS: FriendGoing[] = [];

/**
 * Calendar action sheet for one day.
 *
 * - Past: attendance, plus a read-only reservation tab if one exists
 * - Today: attendance and the day planner
 * - Future: the day planner alone, with no segmented control
 *
 * The planner holds the day's single status (not going, planning, reserved)
 * and who else is going.
 */
export function CalendarActionSheet({
  isOpen,
  onClose,
  festivalId,
  festivalTimezone,
  festivalStartDate,
  festivalEndDate,
  selectedDate,
  existingAttendance,
  existingReservation,
  existingPlan = null,
  canPlan = true,
  friends = NO_FRIENDS,
  onSuccess,
  checkInMode = false,
  prefillTentId,
}: CalendarActionSheetProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("attendance");

  const timezone = festivalTimezone ?? TIMEZONE;

  // Past, today or future on the festival's clock, as the API decides it
  const dayRelation = classifyFestivalDay(selectedDate, new Date(), timezone);
  const isPastDate = dayRelation === "past";
  const isFutureDate = dayRelation === "future";

  const availableTabs = useMemo((): Tab[] => {
    if (isFutureDate) {
      return [];
    }

    const attendanceTab: Tab = { key: "attendance", label: t("attendance.tabs.attendance") };

    if (isPastDate) {
      // Past dates can't take a new reservation, but an existing one stays
      // readable so reservation history isn't write-only.
      return [
        attendanceTab,
        {
          key: "reservation",
          label: t("attendance.tabs.reservation"),
          disabled: !existingReservation,
        },
      ];
    }

    return [attendanceTab, { key: "plan", label: t("attendance.tabs.plan"), disabled: !canPlan }];
  }, [t, isPastDate, isFutureDate, existingReservation, canPlan]);

  const determineDefaultTab = useCallback((): TabKey => {
    // Check-in mode always opens to attendance
    if (checkInMode) {
      return "attendance";
    }
    if (isFutureDate) {
      return "plan";
    }
    // Past date - attendance, unless the only thing logged that day was a
    // reservation, in which case an empty attendance form is the wrong landing.
    if (isPastDate) {
      return !existingAttendance && existingReservation ? "reservation" : "attendance";
    }
    // Today - attendance if logged, else the plan if one exists, else attendance
    if (existingAttendance) {
      return "attendance";
    }
    if (existingPlan && canPlan) {
      return "plan";
    }
    return "attendance";
  }, [
    checkInMode,
    isFutureDate,
    isPastDate,
    existingAttendance,
    existingReservation,
    existingPlan,
    canPlan,
  ]);

  // Reset active tab when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Use queueMicrotask to defer state update and avoid lint warning
      queueMicrotask(() => {
        setActiveTab(determineDefaultTab());
      });
    }
  }, [isOpen, determineDefaultTab]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey);
  }, []);

  // The planner doesn't report tents, so its success carries none
  const handlePlanSuccess = useCallback(() => {
    onSuccess?.({ date: selectedDate, tentIds: [] });
  }, [onSuccess, selectedDate]);

  // Format date for display
  const formattedDate =
    selectedDate && !isNaN(selectedDate.getTime())
      ? formatLocalized(selectedDate, "EEEE, MMMM d, yyyy")
      : t("common.labels.selectDate");

  const plannerKey = `${format(selectedDate, "yyyy-MM-dd")}-${existingPlan?.id ?? "new"}`;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header with close button */}
        <HStack className="mb-2 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">{formattedDate}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        {availableTabs.length > 0 && (
          <VStack className="mb-4 w-full px-2">
            <SegmentedControl
              tabs={availableTabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </VStack>
        )}

        <ActionsheetScrollView className="w-full">
          {activeTab === "attendance" && !isFutureDate && (
            <AttendanceTabContent
              festivalId={festivalId}
              festivalStartDate={festivalStartDate}
              festivalEndDate={festivalEndDate}
              selectedDate={selectedDate}
              existingAttendance={existingAttendance}
              onSuccess={onSuccess}
              onClose={onClose}
              prefillTentId={checkInMode ? prefillTentId : undefined}
            />
          )}

          {activeTab === "reservation" && isPastDate && existingReservation && (
            <ReservationTabContent existingReservation={existingReservation} onClose={onClose} />
          )}

          {activeTab === "plan" && !isPastDate && canPlan && (
            <DayPlanner
              key={plannerKey}
              festivalId={festivalId}
              timezone={timezone}
              selectedDate={selectedDate}
              existingPlan={existingPlan}
              friends={friends}
              onSuccess={onSuccess ? handlePlanSuccess : undefined}
              onClose={onClose}
            />
          )}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

CalendarActionSheet.displayName = "CalendarActionSheet";

// Re-export types for convenience
export type { AttendanceSuccessData } from "./attendance-tab-content";
export type { Tab } from "@/components/ui/segmented-control";
