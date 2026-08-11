"use client";

// Use standardSchemaResolver instead of zodResolver to avoid Turbopack build failures
// caused by @hookform/resolvers v5.x importing "zod/v4/core" which Turbopack cannot resolve.
// See: https://github.com/colinhacks/zod/issues/4879
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useFestival } from "@prostcounter/shared/contexts";
import { useConsumptions, useDrinkPrice, useTipCalculation } from "@prostcounter/shared/hooks";
import type {
  AttendanceByDate,
  DetailedAttendanceForm,
  DrinkType,
} from "@prostcounter/shared/schemas";
import { createDetailedAttendanceFormSchema } from "@prostcounter/shared/schemas";
import { isToday, isWithinInterval } from "date-fns";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { DrinkTypePicker } from "@/components/attendance/drink-type-picker";
import { LocalDrinkStepper } from "@/components/attendance/local-drink-stepper";
import TentSelector from "@/components/TentSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { formatDateForDatabase } from "@/lib/date-utils";
import { getFestivalDates } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";

import { AttendanceDatePicker } from "./AttendanceDatePicker";
import { BeerPicturesUpload } from "./BeerPicturesUpload";
import { LogAnotherVisit } from "./LogAnotherVisit";

interface DetailedAttendanceFormProps {
  onAttendanceUpdate: () => void;
  selectedDate: Date | null;
}

export default function DetailedAttendanceForm({
  onAttendanceUpdate,
  selectedDate,
}: DetailedAttendanceFormProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { getDrinkPriceCents } = useDrinkPrice({
    festivalBeerCost: currentFestival?.beerCost,
  });
  const { calculatePricePaid } = useTipCalculation();
  const [existingAttendance, setExistingAttendance] = useState<AttendanceByDate | null>(null);
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");
  const [localDrinkCounts, setLocalDrinkCounts] = useState<Record<DrinkType, number>>({
    beer: 0,
    radler: 0,
    wine: 0,
    soft_drink: 0,
    alcohol_free: 0,
    other: 0,
  });

  // Create dynamic schema based on current festival
  const detailedAttendanceSchema = useMemo(() => {
    if (!currentFestival) return null;

    const festivalDates = getFestivalDates(currentFestival);
    if (!festivalDates) return null;

    return createDetailedAttendanceFormSchema(festivalDates.startDate, festivalDates.endDate);
  }, [currentFestival]);

  const initialDate = useMemo(() => {
    if (!currentFestival) return new Date();

    const festivalDates = getFestivalDates(currentFestival);
    if (!festivalDates) return new Date();

    return isWithinInterval(new Date(), {
      start: festivalDates.startDate,
      end: festivalDates.endDate,
    })
      ? new Date()
      : festivalDates.startDate;
  }, [currentFestival]);

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);

  // Fetch consumptions for the current date
  const dateString = useMemo(() => formatDateForDatabase(currentDate), [currentDate]);
  const { data: consumptionsData } = useConsumptions(currentFestival?.id || "", dateString);
  const consumptions = useMemo(() => consumptionsData || [], [consumptionsData]);

  // Calculate drink counts from consumptions
  const drinkCounts = useMemo(() => {
    const counts: Record<DrinkType, number> = {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    };
    for (const c of consumptions) {
      if (counts[c.drinkType] !== undefined) {
        counts[c.drinkType]++;
      }
    }
    return counts;
  }, [consumptions]);

  // Calculate total drinks
  const totalLocalDrinks = useMemo(() => {
    return Object.values(localDrinkCounts).reduce((sum, count) => sum + count, 0);
  }, [localDrinkCounts]);

  // Track which date we've initialized counts for (with data)
  const initializedDateRef = useRef<string | null>(null);
  const prevDateRef = useRef<string | null>(null);

  // Sync local counts with server data when consumptions load or date changes
  useEffect(() => {
    const currentDateStr = formatDateForDatabase(currentDate);

    // Date changed - need to reset
    if (prevDateRef.current !== currentDateStr) {
      startTransition(() => {
        setLocalDrinkCounts({
          beer: 0,
          radler: 0,
          wine: 0,
          soft_drink: 0,
          alcohol_free: 0,
          other: 0,
        });
      });
      initializedDateRef.current = null;
      prevDateRef.current = currentDateStr;
      return;
    }

    // Consumptions loaded for this date - need to initialize
    if (consumptions.length > 0 && initializedDateRef.current !== currentDateStr) {
      startTransition(() => {
        setLocalDrinkCounts(drinkCounts);
      });
      initializedDateRef.current = currentDateStr;
    }
  }, [currentDate, consumptions.length, drinkCounts]);

  // Handle local drink count change
  const handleLocalDrinkCountChange = useCallback((drinkType: DrinkType, newCount: number) => {
    setLocalDrinkCounts((prev) => ({
      ...prev,
      [drinkType]: newCount,
    }));
  }, []);

  /** Returns whether the refresh actually landed, so callers can stay honest. */
  const fetchAttendanceForDate = useCallback(
    async (date: Date): Promise<boolean> => {
      if (!currentFestival) return false;

      try {
        const dateString = formatDateForDatabase(date);
        const { attendance } = await apiClient.attendance.getByDate({
          festivalId: currentFestival.id,
          date: dateString,
        });
        startTransition(() => {
          setExistingAttendance(attendance);
        });
        return true;
      } catch {
        toast.error(t("notifications.error.attendanceLoadFailed"));
        return false;
      }
    },
    [currentFestival, t],
  );

  useEffect(() => {
    fetchAttendanceForDate(currentDate);
  }, [fetchAttendanceForDate, currentDate]);

  useEffect(() => {
    if (selectedDate === null) {
      startTransition(() => {
        setCurrentDate(initialDate);
      });
    } else {
      startTransition(() => {
        setCurrentDate(selectedDate);
      });
    }
  }, [initialDate, selectedDate]);

  const {
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DetailedAttendanceForm>({
    resolver: standardSchemaResolver(detailedAttendanceSchema!),
    defaultValues: {
      amount: 0,
      date: currentDate,
      tents: [],
    },
  });

  // Update form values when existingAttendance or currentDate changes
  useEffect(() => {
    setValue("amount", totalLocalDrinks);
    setValue("date", currentDate);
    setValue("tents", existingAttendance?.tentIds || []);
  }, [existingAttendance, currentDate, setValue, totalLocalDrinks]);

  const onSubmit = async (data: DetailedAttendanceForm) => {
    try {
      const submitDateString = formatDateForDatabase(data.date);

      // Update attendance with tent info (amount no longer written; consumptions are the source of truth)
      await apiClient.attendance.updatePersonal({
        festivalId: currentFestival!.id,
        date: submitDateString,
        tents: data.tents,
        amount: 0,
      });

      // Sync consumptions: calculate delta and create/delete as needed
      for (const type of Object.keys(localDrinkCounts) as DrinkType[]) {
        const currentCount = drinkCounts[type] || 0;
        const desiredCount = localDrinkCounts[type] || 0;
        const delta = desiredCount - currentCount;

        if (delta > 0) {
          // Create new consumptions
          const basePriceCents = getDrinkPriceCents(type);
          for (let i = 0; i < delta; i++) {
            await apiClient.consumption.log({
              festivalId: currentFestival!.id,
              date: submitDateString,
              drinkType: type,
              pricePaidCents: calculatePricePaid(basePriceCents),
              basePriceCents,
              volumeMl: 1000,
            });
          }
        } else if (delta < 0) {
          // Delete consumptions
          const typeConsumptions = consumptions
            .filter((c) => c.drinkType === type)
            .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

          for (let i = 0; i < Math.abs(delta); i++) {
            if (typeConsumptions[i]) {
              await apiClient.consumption.delete(typeConsumptions[i].id);
            }
          }
        }
      }

      toast.success(t("notifications.success.attendanceUpdated"));
      await fetchAttendanceForDate(data.date);
      onAttendanceUpdate();
    } catch {
      toast.error(t("notifications.error.attendanceUpdateFailed"));
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (!date) return;
    setCurrentDate(date);
  };

  /*
   * When "log another visit" is offered.
   *
   * Needs a visit to revisit: with none yet the tent selector already expresses
   * everything, since a first visit is what selecting a tent means.
   *
   * Today only, because the visit is stamped with the current time and the server
   * derives the visit's day from that timestamp - on a past day it would file the
   * visit under today instead. Backdating to an invented hour is a different
   * feature; this one means "I just moved tents".
   */
  const canLogRevisit = (existingAttendance?.tentVisits?.length ?? 0) > 0 && isToday(currentDate);

  // Refetching is what keeps the tent field in step: the effect above resets
  // `tents` from the server's tentIds, which already includes the logged tent.
  // Without that, submitting would reconcile the day to a set missing the tent
  // and delete its brand-new visit.
  //
  // So the form has to stay un-submittable until the refetch lands. The window is
  // small but the loss is silent and server-side: on a slow connection, pressing
  // Update while the old tent set was still in the field sent that set, and the
  // RPC reconciled the day to it - deleting the visit just logged.
  const [isRefreshingAfterVisit, setIsRefreshingAfterVisit] = useState(false);

  const handleVisitLogged = useCallback(async () => {
    setIsRefreshingAfterVisit(true);
    try {
      const refreshed = await fetchAttendanceForDate(currentDate);
      onAttendanceUpdate();
      // Only claim success once the visit is actually visible. fetch already
      // reported its own failure, and following it with "attendance updated"
      // told the user two contradictory things about one action.
      if (refreshed) {
        toast.success(t("notifications.success.attendanceUpdated"));
      }
    } finally {
      setIsRefreshingAfterVisit(false);
    }
  }, [fetchAttendanceForDate, currentDate, onAttendanceUpdate, t]);

  const handlePicturesUpdate = (newUrls: string[]) => {
    if (existingAttendance) {
      setExistingAttendance({
        ...existingAttendance,
        pictureUrls: newUrls,
      });
    }
  };

  // Don't render the form if we don't have festival data or schema
  if (!currentFestival || !detailedAttendanceSchema) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p>{t("common.status.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">{t("attendance.registerOrUpdate")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
          <Label htmlFor="date">{t("attendance.whenDidYouVisit")}</Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <AttendanceDatePicker
                buttonClassName="w-auto self-center"
                disabled={isSubmitting}
                value={field.value}
                onDateChange={(date) => {
                  field.onChange(date!);
                  handleDateChange(date);
                }}
                festivalStartDate={getFestivalDates(currentFestival)?.startDate || new Date()}
                festivalEndDate={getFestivalDates(currentFestival)?.endDate || new Date()}
              />
            )}
          />
          {errors.date && <span className="error">{t(errors.date.message as string)}</span>}

          <Label htmlFor="amount">{t("attendance.howManyDrinks")}</Label>

          {/* Drink Type Picker + Stepper */}
          <div className="flex w-full flex-col items-center gap-4">
            <DrinkTypePicker
              selectedType={selectedDrinkType}
              onSelect={setSelectedDrinkType}
              counts={localDrinkCounts}
              disabled={isSubmitting}
            />

            <LocalDrinkStepper
              drinkType={selectedDrinkType}
              count={localDrinkCounts[selectedDrinkType]}
              onChange={handleLocalDrinkCountChange}
              disabled={isSubmitting}
            />

            {/* Total drinks */}
            <p className="text-muted-foreground text-sm">
              {t("attendance.totalDrinks")}: {totalLocalDrinks}
            </p>
          </div>

          {errors.amount && (
            <span className="text-sm text-red-600">{t(errors.amount.message as string)}</span>
          )}

          <Label htmlFor="tents">{t("attendance.whichTents")}</Label>
          <Controller
            name="tents"
            control={control}
            render={({ field }) => (
              <TentSelector
                disabled={isSubmitting}
                selectedTents={field.value}
                onTentsChange={(newTents) => {
                  field.onChange(newTents);
                }}
              />
            )}
          />
          <Button
            variant="yellowOutline"
            className="self-center"
            type="submit"
            disabled={isSubmitting || isRefreshingAfterVisit}
          >
            {existingAttendance ? t("attendance.form.update") : t("attendance.form.submit")}
          </Button>
        </form>

        {canLogRevisit && (
          <div className="mt-8">
            <LogAnotherVisit
              festivalId={currentFestival.id}
              disabled={isSubmitting || isRefreshingAfterVisit}
              onLogged={handleVisitLogged}
            />
          </div>
        )}

        {existingAttendance && (
          <div className="mt-8">
            <BeerPicturesUpload
              key={existingAttendance.id} // Ensure re-render when existingAttendance changes
              attendanceId={existingAttendance.id}
              existingPictureUrls={existingAttendance.pictureUrls || []}
              onPicturesUpdate={handlePicturesUpdate}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
