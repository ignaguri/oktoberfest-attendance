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
import { createDetailedAttendanceSchema } from "@/lib/schemas/attendance";
import {
  addPersonalAttendance,
  fetchAttendanceByDate,
} from "@/lib/sharedActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { isWithinInterval } from "date-fns";
import { useState, useEffect, useCallback, useMemo } from "react";
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
        setExistingAttendance(attendanceData as AttendanceByDate);
      } catch {
        toast.error("Failed to fetch attendance data. Please try again.");
      }
    },
    [currentFestival],
  );

  useEffect(() => {
    fetchAttendanceForDate(currentDate);
  }, [fetchAttendanceForDate, currentDate]);

  useEffect(() => {
    if (selectedDate === null) {
      setCurrentDate(initialDate);
    } else {
      setCurrentDate(selectedDate);
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
    setValue("amount", existingAttendance?.beer_count ?? 0);
    setValue("date", currentDate);
    setValue("tents", existingAttendance?.tent_ids || []);
  }, [existingAttendance, currentDate, setValue]);

  const onSubmit = async (data: DetailedAttendanceFormData) => {
    try {
      await addPersonalAttendance({ ...data, festivalId: currentFestival!.id });
      toast.success("Attendance updated successfully.");
      await fetchAttendanceForDate(data.date);
      onAttendanceUpdate();
    } catch {
      toast.error("Failed to update attendance. Please try again.");
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
          <p>Loading festival data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          Register or update your attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
          <Label htmlFor="date">When did you visit the Wiesn?</Label>
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

          <Label htmlFor="amount">How many 🍻 Maß did you have?</Label>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value?.toString() ?? "0"}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <SelectTrigger id="amount" className="w-auto self-center">
                  <SelectValue placeholder="Select amount" />
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

          <Label htmlFor="tents">Which tents did you visit?</Label>
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
            {existingAttendance ? "Update" : "Submit"}
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
