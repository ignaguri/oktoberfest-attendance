import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  AttendanceWithTotals,
  Reservation,
} from "@prostcounter/shared/schemas";
import { endOfDay, format, isAfter, isBefore, startOfDay } from "date-fns";
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
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

import { AttendanceTabContent } from "./attendance-tab-content";
import { ReservationTabContent } from "./reservation-tab-content";
import { type Tab, TabBar } from "./tab-bar";

export type TabKey = "attendance" | "reservation";

export interface CalendarActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceWithTotals | null;
  existingReservation?: Reservation | null;
  onSuccess?: () => void;
  // Check-in mode: pre-fill tent from reservation
  checkInMode?: boolean;
  prefillTentId?: string;
}

/**
 * Calendar action sheet with tabs for attendance and reservations
 *
 * Tab availability is determined by the selected date:
 * - Past dates: Only attendance tab
 * - Today: Both tabs available
 * - Future dates: Only reservation tab
 *
 * Features:
 * - Smart default tab based on date and existing data
 * - Shared date header
 * - Seamless tab switching
 * - Check-in mode for reservation flow
 */
export function CalendarActionSheet({
  isOpen,
  onClose,
  festivalId,
  festivalStartDate,
  festivalEndDate,
  selectedDate,
  existingAttendance,
  existingReservation,
  onSuccess,
  checkInMode = false,
  prefillTentId,
}: CalendarActionSheetProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("attendance");

  // Determine date category
  const today = new Date();
  const isPastDate = isBefore(selectedDate, startOfDay(today));
  const isFutureDate = isAfter(selectedDate, endOfDay(today));

  // Determine available tabs based on date
  const availableTabs = useMemo((): Tab[] => {
    const attendanceTab: Tab = {
      key: "attendance",
      label: t("attendance.tabs.attendance", { defaultValue: "Attendance" }),
      disabled: isFutureDate,
    };

    const reservationTab: Tab = {
      key: "reservation",
      label: t("attendance.tabs.reservation", { defaultValue: "Reservation" }),
      disabled: isPastDate,
    };

    return [attendanceTab, reservationTab];
  }, [t, isPastDate, isFutureDate]);

  // Determine default tab when sheet opens
  const determineDefaultTab = useCallback((): TabKey => {
    // Check-in mode always opens to attendance
    if (checkInMode) return "attendance";

    // Future date - reservation only
    if (isFutureDate) return "reservation";

    // Past date - attendance only
    if (isPastDate) return "attendance";

    // Today - prefer attendance if exists, else reservation if exists, else attendance
    if (existingAttendance) return "attendance";
    if (existingReservation) return "reservation";

    return "attendance";
  }, [
    checkInMode,
    isFutureDate,
    isPastDate,
    existingAttendance,
    existingReservation,
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

  // Handle tab change
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey);
  }, []);

  // Format date for display
  const formattedDate =
    selectedDate && !isNaN(selectedDate.getTime())
      ? format(selectedDate, "EEEE, MMMM d, yyyy")
      : t("common.labels.selectDate", { defaultValue: "Select a date" });

  // Should show single tab or both?
  const showTabs = !isPastDate || !isFutureDate; // Always show tabs for now, disabled state handles access

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header with close button */}
        <HStack className="mb-2 w-full items-center justify-between px-2">
          <Text className="text-typography-900 text-lg font-semibold">
            {formattedDate}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        {/* Tab Bar */}
        <VStack className="mb-4 w-full px-2">
          <TabBar
            tabs={availableTabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </VStack>

        {/* Tab Content */}
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

          {activeTab === "reservation" && !isPastDate && (
            <ReservationTabContent
              festivalId={festivalId}
              selectedDate={selectedDate}
              existingReservation={existingReservation}
              onSuccess={onSuccess}
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
export type { Tab } from "./tab-bar";
