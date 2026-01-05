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
import { getFestivalDates } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";
import { createDetailedAttendanceSchema } from "@/lib/schemas/attendance";
import {
  addPersonalAttendance,
  fetchAttendanceByDate,
} from "@/lib/sharedActions";
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
import type { AttendanceByDate } from "@/lib/sharedActions";

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
        const attendanceData = await fetchAttendanceByDate(
          date,
          currentFestival.id,
        );
        startTransition(() => {
          setExistingAttendance(attendanceData as AttendanceByDate);
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
    // Convert beer_count to number since the view returns bigint as string
    setValue("amount", Number(existingAttendance?.beer_count) || 0);
    setValue("date", currentDate);
    setValue("tents", existingAttendance?.tent_ids || []);
  }, [existingAttendance, currentDate, setValue]);

  const onSubmit = async (data: DetailedAttendanceFormData) => {
    try {
      await addPersonalAttendance({ ...data, festivalId: currentFestival!.id });
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
        picture_urls: newUrls,
      });
    }
  };

  // Don't render the form if we don't have festival data or schema
  if (!currentFestival || !detailedAttendanceSchema) {
    return (
      <Card>
        <CardContent className="text-center py-8">
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
              existingPictureUrls={existingAttendance.picture_urls || []}
              onPicturesUpdate={handlePicturesUpdate}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
