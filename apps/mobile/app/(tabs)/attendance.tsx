import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { format } from "date-fns";

import { useAttendances, useDeleteAttendance } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AttendanceWithTotals } from "@prostcounter/shared/schemas";

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
import { useFestival } from "@/lib/festival/FestivalContext";

import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { AttendanceFormSheet } from "@/components/attendance/attendance-form-sheet";

export default function AttendanceScreen() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();

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

  const deleteAttendanceMutation = useDeleteAttendance();

  // Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Parse festival dates
  const festivalStartDate = useMemo(
    () => (currentFestival ? new Date(currentFestival.startDate) : new Date()),
    [currentFestival]
  );
  const festivalEndDate = useMemo(
    () => (currentFestival ? new Date(currentFestival.endDate) : new Date()),
    [currentFestival]
  );

  // Find existing attendance for selected date
  // Use format() instead of toISOString() to avoid UTC timezone shift
  const existingAttendance = useMemo(() => {
    if (!selectedDate || !attendances) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return (attendances as AttendanceWithTotals[]).find((a) => a.date === dateStr) ?? null;
  }, [selectedDate, attendances]);

  // Transform attendances for calendar
  const calendarAttendances = useMemo(() => {
    if (!attendances) return [];
    return (attendances as AttendanceWithTotals[]).map((a) => ({
      date: a.date,
      beerCount: a.beerCount,
    }));
  }, [attendances]);

  // Handlers
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    // Keep selectedDate so calendar shows selection
  }, []);

  const handleFormSuccess = useCallback(() => {
    refetch();
    showDialog(
      t("common.status.success"),
      existingAttendance
        ? t("attendance.updateSuccess")
        : t("attendance.createSuccess")
    );
  }, [refetch, showDialog, existingAttendance, t]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDeletePress = useCallback(() => {
    if (!existingAttendance) return;

    showDialog(
      t("attendance.delete.title"),
      t("attendance.delete.confirm"),
      "destructive",
      async () => {
        try {
          await deleteAttendanceMutation.mutateAsync(existingAttendance.id);
          refetch();
          setIsFormOpen(false);
          showDialog(t("common.status.success"), t("attendance.delete.success"));
        } catch {
          showDialog(t("common.status.error"), t("attendance.delete.error"));
        }
      }
    );
  }, [existingAttendance, deleteAttendanceMutation, refetch, showDialog, t]);

  // No festival selected
  if (!currentFestival) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <Text className="text-typography-500 text-center">
          {t("attendance.noFestival")}
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (attendancesError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ErrorState error={attendancesError} onRetry={refetch} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl refreshing={isRefetching ?? false} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          {/* Header */}
          <Text className="text-sm text-typography-500 mb-4 text-center">
            {t("attendance.calendar.tapToAddOrEdit")}
          </Text>

          {/* Calendar */}
          <AttendanceCalendar
            festivalStartDate={festivalStartDate}
            festivalEndDate={festivalEndDate}
            attendances={calendarAttendances}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Stats Summary */}
          {attendances && (attendances as AttendanceWithTotals[]).length > 0 && (
            <View className="mt-4 p-4 bg-background-0 rounded-xl">
              <Text className="text-sm font-medium text-typography-700 mb-2">
                {t("attendance.summary.title")}
              </Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary-500">
                    {(attendances as AttendanceWithTotals[]).length}
                  </Text>
                  <Text className="text-xs text-typography-500">
                    {t("attendance.summary.days")}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary-500">
                    {(attendances as AttendanceWithTotals[]).reduce(
                      (sum, a) => sum + a.beerCount,
                      0
                    )}
                  </Text>
                  <Text className="text-xs text-typography-500">
                    {t("attendance.summary.beers")}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary-500">
                    {(
                      (attendances as AttendanceWithTotals[]).reduce(
                        (sum, a) => sum + a.beerCount,
                        0
                      ) / (attendances as AttendanceWithTotals[]).length
                    ).toFixed(1)}
                  </Text>
                  <Text className="text-xs text-typography-500">
                    {t("attendance.summary.avgPerDay")}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Attendance Form Sheet */}
      {selectedDate && (
        <AttendanceFormSheet
          isOpen={isFormOpen}
          onClose={handleFormClose}
          festivalId={currentFestival.id}
          festivalStartDate={festivalStartDate}
          festivalEndDate={festivalEndDate}
          selectedDate={selectedDate}
          existingAttendance={existingAttendance}
          onSuccess={handleFormSuccess}
        />
      )}

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
                  action={dialog.type === "destructive" ? "negative" : "primary"}
                  onPress={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  className="flex-1"
                >
                  <ButtonText>
                    {dialog.type === "destructive"
                      ? t("common.buttons.delete", { defaultValue: "Delete" })
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
