"use client";

import TentSelector from "@/components/TentSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFestival } from "@/contexts/FestivalContext";
import { apiClient } from "@/lib/api-client";
import { formatDateForDatabase } from "@/lib/date-utils";
import { getFestivalDates } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";
import { createDetailedAttendanceSchema } from "@/lib/schemas/attendance";
import { zodResolver } from "@hookform/resolvers/zod";
import { isWithinInterval } from "date-fns";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";

import type { DetailedAttendanceFormData } from "@/lib/schemas/attendance";
import type { AttendanceByDate } from "@prostcounter/shared/schemas";

import { AttendanceDatePicker } from "./AttendanceDatePicker";
import { BeerPicturesUpload } from "./BeerPicturesUpload";

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
  const [existingAttendance, setExistingAttendance] =
    useState<AttendanceByDate | null>(null);

  // Create dynamic schema based on current festival
  const detailedAttendanceSchema = useMemo(() => {
    if (!currentFestival) return null;

    const festivalDates = getFestivalDates(currentFestival);
    if (!festivalDates) return null;

    return createDetailedAttendanceSchema(
      festivalDates.startDate,
      festivalDates.endDate,
    );
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

  const fetchAttendanceForDate = useCallback(
    async (date: Date) => {
      if (!currentFestival) return;

      try {
        const dateString = formatDateForDatabase(date);
        const { attendance } = await apiClient.attendance.getByDate({
          festivalId: currentFestival.id,
          date: dateString,
        });
        startTransition(() => {
          setExistingAttendance(attendance);
        });
      } catch {
        toast.error(t("notifications.error.attendanceLoadFailed"));
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
  } = useForm<DetailedAttendanceFormData>({
    resolver: zodResolver(detailedAttendanceSchema!),
    defaultValues: {
      amount: 0,
      date: currentDate,
      tents: [],
    },
  });

  // Update form values when existingAttendance or currentDate changes
  useEffect(() => {
    setValue("amount", existingAttendance?.beerCount || 0);
    setValue("date", currentDate);
    setValue("tents", existingAttendance?.tentIds || []);
  }, [existingAttendance, currentDate, setValue]);

  const onSubmit = async (data: DetailedAttendanceFormData) => {
    try {
      const dateString = formatDateForDatabase(data.date);
      await apiClient.attendance.updatePersonal({
        festivalId: currentFestival!.id,
        date: dateString,
        tents: data.tents,
        amount: data.amount,
      });
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
        <CardTitle className="text-center">
          {t("attendance.registerOrUpdate")}
        </CardTitle>
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
                festivalStartDate={
                  getFestivalDates(currentFestival)?.startDate || new Date()
                }
                festivalEndDate={
                  getFestivalDates(currentFestival)?.endDate || new Date()
                }
              />
            )}
          />
          {errors.date && <span className="error">{errors.date.message}</span>}

          <Label htmlFor="amount">{t("attendance.howManyBeers")}</Label>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value?.toString() ?? "0"}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <SelectTrigger id="amount" className="w-auto self-center">
                  <SelectValue placeholder={t("attendance.selectAmount")} />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(10)].map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.amount && (
            <span className="text-sm text-red-600">
              {errors.amount.message}
            </span>
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
            disabled={isSubmitting}
          >
            {existingAttendance
              ? t("attendance.form.update")
              : t("attendance.form.submit")}
          </Button>
        </form>

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
