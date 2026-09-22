import { ApiError } from "@prostcounter/api-client";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { useAdminFestivalTents, useUpdateAdminAttendance } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AdminAttendance } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { CalendarDays, Check, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface EditAttendanceSheetProps {
  attendance: AdminAttendance;
  onClose: () => void;
  onError: (message: string) => void;
}

/**
 * Edits one day: its date, its beer count and the tents visited on it.
 *
 * Mounted only while a row is being edited, and keyed on the attendance id, so
 * the draft below is seeded once from props and a background refetch of the
 * list cannot overwrite what is being typed. The tent list is only fetched
 * while this is open, since the user detail screen has no other use for it.
 *
 * The beer count is editable only on a day with no consumptions. See
 * `drink_count` on AdminAttendanceSchema: the view reads
 * `attendances.beer_count` only when the day has none, so on any other day
 * this write would save cleanly and change nothing the admin can see.
 */
export function EditAttendanceSheet({ attendance, onClose, onError }: EditAttendanceSheetProps) {
  const { t } = useTranslation();

  const {
    tents,
    isLoading: tentsLoading,
    error: tentsError,
    refetch: refetchTents,
  } = useAdminFestivalTents(attendance.festival_id);
  const updateAttendance = useUpdateAdminAttendance();

  // Midday rather than midnight: the picker hands back a local Date, and a
  // day that starts at 00:00 is one DST hour away from becoming the day before.
  const [date, setDate] = useState(() => parseDayAtMidday(attendance.date));
  const [showPicker, setShowPicker] = useState(false);
  const [beerCount, setBeerCount] = useState(() => String(attendance.beer_count));
  const [tentIds, setTentIds] = useState<string[]>(() => attendance.tent_ids);

  const beerCountIsLive = attendance.drink_count === 0;
  const parsedBeerCount = Number.parseInt(beerCount, 10);
  const beerCountInvalid =
    beerCountIsLive && (!/^\d+$/.test(beerCount.trim()) || Number.isNaN(parsedBeerCount));

  // onValueChange/onDismiss rather than onChange: the latter is deprecated in
  // datetimepicker 9 and warns at runtime. Android's picker is a modal that
  // closes itself once a value is chosen; iOS keeps the spinner inline, which
  // is what the Done button below is for.
  const handleDateChange = useCallback((_event: unknown, picked: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    setDate(picked);
  }, []);

  const handlePickerDismiss = useCallback(() => setShowPicker(false), []);

  const toggleTent = useCallback((tentId: string) => {
    setTentIds((current) =>
      current.includes(tentId) ? current.filter((id) => id !== tentId) : [...current, tentId],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (beerCountInvalid) {
      onError(t("admin.mobile.userDetail.edit.beersInvalid"));
      return;
    }

    try {
      await updateAttendance.mutate({
        attendanceId: attendance.id,
        data: {
          // The calendar day the admin picked, read on the device's own clock.
          // Not formatDateForDatabase: that reprojects onto the festival's
          // timezone, which east of it hands back the day before the one on
          // screen. `attendances.date` is a plain date column, so the literal
          // day is what belongs in it.
          date: format(date, "yyyy-MM-dd"),
          tent_ids: tentIds,
          ...(beerCountIsLive ? { beer_count: parsedBeerCount } : {}),
        },
      });
      onClose();
    } catch (err) {
      // The day already exists for this user: `attendances` carries
      // UNIQUE(user_id, festival_id, date) and the route answers 409 rather
      // than letting the constraint escape as a 500.
      if (err instanceof ApiError && err.code === ErrorCodes.DUPLICATE_ATTENDANCE) {
        onError(t("admin.mobile.userDetail.edit.duplicateDate"));
        return;
      }
      onError(t("admin.mobile.userDetail.edit.saveError"));
    }
  }, [
    attendance.id,
    beerCountInvalid,
    beerCountIsLive,
    date,
    onClose,
    onError,
    parsedBeerCount,
    t,
    tentIds,
    updateAttendance,
  ]);

  return (
    <Actionsheet isOpen onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-4 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("admin.mobile.userDetail.edit.title")}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("common.buttons.close")}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="px-2 pb-4">
            {/* Date */}
            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {t("admin.mobile.userDetail.edit.date")}
              </Text>
              <Pressable
                onPress={() => setShowPicker((open) => !open)}
                className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel={t("admin.mobile.userDetail.edit.date")}
                accessibilityValue={{ text: format(date, "yyyy-MM-dd") }}
              >
                <HStack space="sm" className="items-center">
                  <CalendarDays size={18} color={IconColors.muted} />
                  <Text className="text-base text-typography-900">
                    {format(date, "yyyy-MM-dd")}
                  </Text>
                </HStack>
              </Pressable>

              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onValueChange={handleDateChange}
                  onDismiss={handlePickerDismiss}
                  accentColor={Colors.primary[500]}
                />
              )}

              {showPicker && Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setShowPicker(false)}
                  className="items-center rounded-lg bg-primary-500 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={t("common.buttons.done")}
                >
                  <Text className="font-medium text-white">{t("common.buttons.done")}</Text>
                </Pressable>
              )}
            </VStack>

            {/* Beer count */}
            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {t("admin.mobile.userDetail.edit.beers")}
              </Text>
              <Input isDisabled={!beerCountIsLive} isInvalid={beerCountInvalid}>
                <InputField
                  value={beerCount}
                  onChangeText={setBeerCount}
                  keyboardType="number-pad"
                  accessibilityLabel={t("admin.mobile.userDetail.edit.beers")}
                />
              </Input>
              <Text
                className={cn(
                  "text-sm",
                  beerCountInvalid ? "text-error-600" : "text-typography-500",
                )}
              >
                {beerCountInvalid
                  ? t("admin.mobile.userDetail.edit.beersInvalid")
                  : beerCountIsLive
                    ? t("admin.mobile.userDetail.edit.beersStored")
                    : t("admin.mobile.userDetail.edit.beersDerived", {
                        count: attendance.drink_count,
                      })}
              </Text>
            </VStack>

            {/* Tents */}
            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {t("admin.mobile.userDetail.edit.tents")}
              </Text>

              {/* A failed fetch also leaves the list empty, so the "no tents"
                  message below would blame the festival for a broken endpoint.
                  Saving stays available: the draft still holds the day's own
                  tent ids, so a save here writes them back unchanged. */}
              {tentsError && <ErrorState message={tentsError} onRetry={refetchTents} />}

              {!tentsError && tentsLoading && (
                <Text className="text-typography-500">
                  {t("admin.mobile.userDetail.edit.tentsLoading")}
                </Text>
              )}

              {!tentsError && !tentsLoading && tents.length === 0 && (
                <Text className="text-typography-500">
                  {t("admin.mobile.userDetail.edit.tentsEmpty")}
                </Text>
              )}

              {tents.map((tent) => {
                const selected = tentIds.includes(tent.tent_id);

                return (
                  <Pressable
                    key={tent.tent_id}
                    onPress={() => toggleTent(tent.tent_id)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={tent.name}
                    accessibilityState={{ checked: selected }}
                  >
                    <Card size="sm" variant={selected ? "elevated" : "outline"}>
                      <HStack className="items-center justify-between">
                        <Text
                          className={cn(
                            "flex-1",
                            selected ? "text-typography-900" : "text-typography-500",
                          )}
                        >
                          {tent.name}
                        </Text>
                        {selected && <Check size={18} color={IconColors.primary} />}
                      </HStack>
                    </Card>
                  </Pressable>
                );
              })}
            </VStack>
          </VStack>
        </ActionsheetScrollView>

        {/*
          Outside the scroll view on purpose. Oktoberfest carries around forty
          tents, so a save button after the list sits forty rows down and the
          admin has to scroll the whole catalogue to commit a date change.
        */}
        <VStack className="w-full px-2 pb-2 pt-3">
          <Button
            isDisabled={updateAttendance.loading || beerCountInvalid}
            onPress={handleSave}
            accessibilityLabel={t("admin.mobile.userDetail.edit.save")}
            accessibilityHint={t("admin.mobile.userDetail.edit.saveHint")}
          >
            {updateAttendance.loading && <ButtonSpinner />}
            <ButtonText>{t("admin.mobile.userDetail.edit.save")}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

/**
 * Reads a `YYYY-MM-DD` column value as that same day on the device's clock.
 *
 * `new Date("2026-09-20")` is parsed as UTC midnight, which renders as the 19th
 * anywhere west of Greenwich. Midday leaves no offset able to move it.
 */
function parseDayAtMidday(day: string): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, month - 1, dayOfMonth, 12);
}
