import { formatDateForDatabase } from "@prostcounter/shared";
import { useFestival } from "@prostcounter/shared/contexts";
import {
  useAttendances,
  useCheckInReservation,
  useReservations,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  AttendanceWithTotals,
  Reservation,
} from "@prostcounter/shared/schemas";
import { format, parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { CalendarActionSheet } from "@/components/attendance/calendar-action-sheet";
import { CheckInDialog } from "@/components/attendance/check-in-dialog";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Heading } from "@/components/ui/heading";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";

export default function AttendanceScreen() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const router = useRouter();
  const { checkInReservationId } = useLocalSearchParams<{
    checkInReservationId?: string;
  }>();

  // Dialog state
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Data hooks
  const {
    data: attendances,
    loading: isLoading,
    error: attendancesError,
    refetch,
    isRefetching,
  } = useAttendances(currentFestival?.id ?? "");

  const {
    data: reservationsData,
    loading: reservationsLoading,
    refetch: refetchReservations,
  } = useReservations(currentFestival?.id);

  const reservations = reservationsData?.reservations ?? [];

  // Check-in mutation
  const checkInReservation = useCheckInReservation();

  // Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInReservation_, setCheckInReservation_] =
    useState<Reservation | null>(null);
  const [checkInMode, setCheckInMode] = useState(false);
  const [prefillTentId, setPrefillTentId] = useState<string | undefined>();

  // Handle check-in from deep link
  // This effect intentionally sets state when a deep link is detected
  useEffect(() => {
    if (checkInReservationId && reservations.length > 0) {
      const reservation = reservations.find(
        (r: Reservation) => r.id === checkInReservationId,
      );
      if (
        reservation &&
        (reservation.status === "pending" || reservation.status === "confirmed")
      ) {
        // Use queueMicrotask to defer state updates and avoid lint warning
        queueMicrotask(() => {
          setCheckInReservation_(reservation);
          setCheckInDialogOpen(true);
          // Clear the query param to prevent re-triggering
          router.setParams({ checkInReservationId: undefined });
        });
      }
    }
  }, [checkInReservationId, reservations, router]);

  // Parse festival dates using parseISO to avoid UTC timezone issues
  // new Date("2024-12-31") parses as UTC midnight, but parseISO treats it as local
  const festivalStartDate = useMemo(
    () => (currentFestival ? parseISO(currentFestival.startDate) : new Date()),
    [currentFestival],
  );
  const festivalEndDate = useMemo(
    () => (currentFestival ? parseISO(currentFestival.endDate) : new Date()),
    [currentFestival],
  );

  // Find existing attendance for selected date
  // Use formatDateForDatabase() for timezone-aware date formatting
  const existingAttendance = useMemo(() => {
    if (!selectedDate || !attendances) return null;
    const dateStr = formatDateForDatabase(selectedDate);
    return (
      (attendances as AttendanceWithTotals[]).find((a) => a.date === dateStr) ??
      null
    );
  }, [selectedDate, attendances]);

  // Find existing reservation for selected date
  // Active statuses: pending, confirmed, and scheduled (legacy from db)
  const existingReservation = useMemo((): Reservation | null => {
    if (!selectedDate || !reservations.length) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return (
      reservations.find((r: Reservation) => {
        const reservationDate = format(new Date(r.startAt), "yyyy-MM-dd");
        // Include "scheduled" for legacy data (status is string in db, typed enum in schema)
        const isActiveStatus =
          r.status === "pending" ||
          r.status === "confirmed" ||
          (r.status as string) === "scheduled";
        return reservationDate === dateStr && isActiveStatus;
      }) ?? null
    );
  }, [selectedDate, reservations]);

  // Transform attendances for calendar
  const calendarAttendances = useMemo(() => {
    if (!attendances) return [];
    return (attendances as AttendanceWithTotals[]).map((a) => ({
      date: a.date,
      drinkCount: a.drinkCount,
    }));
  }, [attendances]);

  // Calculate spending totals from all attendances
  const spendingTotals = useMemo(() => {
    if (!attendances) return { spent: 0, base: 0, tips: 0 };
    return (attendances as AttendanceWithTotals[]).reduce(
      (totals, a) => ({
        spent: totals.spent + (a.totalSpentCents || 0),
        base: totals.base + (a.totalBaseCents || 0),
        tips: totals.tips + (a.totalTipCents || 0),
      }),
      { spent: 0, base: 0, tips: 0 },
    );
  }, [attendances]);

  // Handlers
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setCheckInMode(false);
    setPrefillTentId(undefined);
    // Keep selectedDate so calendar shows selection
  }, []);

  const handleFormSuccess = useCallback(() => {
    refetch();
    refetchReservations();
    showDialog(t("common.status.success"), t("attendance.saveSuccess"));
  }, [refetch, refetchReservations, showDialog, t]);

  const onRefresh = useCallback(() => {
    refetch();
    refetchReservations();
  }, [refetch, refetchReservations]);

  // Handle check-in dialog close
  const handleCheckInDialogClose = useCallback(() => {
    setCheckInDialogOpen(false);
    setCheckInReservation_(null);
  }, []);

  // Handle check-in confirmation
  const handleCheckIn = useCallback(async () => {
    if (!checkInReservation_ || !currentFestival) return;

    try {
      await checkInReservation.mutateAsync({
        reservationId: checkInReservation_.id,
        festivalId: currentFestival.id,
      });

      // Close check-in dialog
      setCheckInDialogOpen(false);

      // Set up check-in mode for attendance form
      setCheckInMode(true);
      setPrefillTentId(checkInReservation_.tentId);

      // Select the reservation date and open the form
      const reservationDate = parseISO(checkInReservation_.startAt);
      setSelectedDate(reservationDate);
      setIsFormOpen(true);

      // Clear the check-in reservation
      setCheckInReservation_(null);

      // Refresh data
      refetch();
      refetchReservations();
    } catch (error) {
      console.error("Failed to check in:", error);
      showDialog(
        t("common.status.error"),
        t("reservation.checkIn.failedDescription"),
      );
    }
  }, [
    checkInReservation_,
    currentFestival,
    checkInReservation,
    refetch,
    refetchReservations,
    showDialog,
    t,
  ]);

  // No festival selected
  if (!currentFestival) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center p-6">
        <Text className="text-typography-500 text-center">
          {t("attendance.noFestival")}
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading || reservationsLoading) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (attendancesError) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center">
        <ErrorState error={attendancesError} onRetry={refetch} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        className="bg-background-50 flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching ?? false}
            onRefresh={onRefresh}
          />
        }
      >
        <View className="p-4">
          {/* Calendar */}
          <AttendanceCalendar
            festivalStartDate={festivalStartDate}
            festivalEndDate={festivalEndDate}
            attendances={calendarAttendances}
            reservations={reservations}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Stats Summary */}
          {attendances &&
            (attendances as AttendanceWithTotals[]).length > 0 && (
              <View className="bg-background-0 mt-4 rounded-xl p-4">
                <Text className="text-typography-700 mb-3 text-sm font-medium">
                  {t("attendance.summary.title")}
                </Text>
                {/* Row 1: Days, Drinks, Avg */}
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-primary-500 text-2xl font-bold">
                      {(attendances as AttendanceWithTotals[]).length}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.days")}
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-primary-500 text-2xl font-bold">
                      {(attendances as AttendanceWithTotals[]).reduce(
                        (sum, a) => sum + a.drinkCount,
                        0,
                      )}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.drinks")}
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-primary-500 text-2xl font-bold">
                      {(
                        (attendances as AttendanceWithTotals[]).reduce(
                          (sum, a) => sum + a.drinkCount,
                          0,
                        ) / (attendances as AttendanceWithTotals[]).length
                      ).toFixed(1)}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.avgPerDay")}
                    </Text>
                  </View>
                </View>
                {/* Row 2: Spending Breakdown */}
                <View className="border-background-200 mt-4 flex-row justify-around border-t pt-4">
                  <View className="items-center">
                    <Text className="text-primary-500 text-2xl font-bold">
                      €{(spendingTotals.spent / 100).toFixed(0)}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.spent")}
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-typography-700 text-2xl font-bold">
                      €{(spendingTotals.base / 100).toFixed(0)}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.baseCost")}
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-success-500 text-2xl font-bold">
                      €{(spendingTotals.tips / 100).toFixed(0)}
                    </Text>
                    <Text className="text-typography-500 text-xs">
                      {t("attendance.summary.tips")}
                    </Text>
                  </View>
                </View>
              </View>
            )}
        </View>
      </ScrollView>

      {/* Calendar Action Sheet (Attendance/Reservation tabs) */}
      {selectedDate && (
        <CalendarActionSheet
          isOpen={isFormOpen}
          onClose={handleFormClose}
          festivalId={currentFestival.id}
          festivalStartDate={festivalStartDate}
          festivalEndDate={festivalEndDate}
          selectedDate={selectedDate}
          existingAttendance={existingAttendance}
          existingReservation={existingReservation}
          onSuccess={handleFormSuccess}
          checkInMode={checkInMode}
          prefillTentId={prefillTentId}
        />
      )}

      {/* Check-in Dialog */}
      <CheckInDialog
        isOpen={checkInDialogOpen}
        onClose={handleCheckInDialogClose}
        reservation={checkInReservation_}
        festivalId={currentFestival.id}
        onCheckIn={handleCheckIn}
        isLoading={checkInReservation.loading}
      />

      {/* Alert Dialog */}
      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading
              size="lg"
              className={
                dialog.type === "destructive"
                  ? "text-error-600"
                  : "text-typography-950"
              }
            >
              {dialog.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {dialog.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            {dialog.onConfirm ? (
              <>
                <Button
                  variant="outline"
                  action="secondary"
                  onPress={closeDialog}
                  className="flex-1"
                >
                  <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                </Button>
                <Button
                  action={
                    dialog.type === "destructive" ? "negative" : "primary"
                  }
                  onPress={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  className="flex-1"
                >
                  <ButtonText>
                    {dialog.type === "destructive"
                      ? t("common.buttons.delete")
                      : t("common.buttons.ok")}
                  </ButtonText>
                </Button>
              </>
            ) : (
              <Button action="primary" onPress={closeDialog} className="flex-1">
                <ButtonText>{t("common.buttons.ok")}</ButtonText>
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GestureHandlerRootView>
  );
}
