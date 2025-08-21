"use client";

import TentSelector from "@/components/TentSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";
import { detailedAttendanceSchema, DetailedAttendanceFormData } from "@/lib/schemas/attendance";
import { addAttendance, fetchAttendanceByDate } from "@/lib/sharedActions";
import { cn } from "@/lib/utils";
import { isWithinInterval } from "date-fns";
import { useState, useEffect, useCallback, useMemo } from "react";

import type { AttendanceByDate } from "@/lib/sharedActions";

import { BeerPicturesUpload } from "./BeerPicturesUpload";
import { MyDatePicker } from "./DatePicker";

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
  const initialDate = useMemo(() => {
    return isWithinInterval(new Date(), {
      start: BEGINNING_OF_WIESN,
      end: END_OF_WIESN,
    })
      ? new Date()
      : BEGINNING_OF_WIESN;
  }, []);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const { toast } = useToast();

  const fetchAttendanceForDate = useCallback(
    async (date: Date) => {
      if (!currentFestival) return;

      try {
        const attendanceData = await fetchAttendanceByDate(
          date,
          currentFestival.id,
        );
        setExistingAttendance(attendanceData as AttendanceByDate);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch attendance data. Please try again.",
        });
      }
    },
    [toast, currentFestival],
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
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DetailedAttendanceFormData>({
    resolver: zodResolver(detailedAttendanceSchema),
    defaultValues: {
      amount: 0,
      date: currentDate,
      tents: [],
    },
  });

  const watchedValues = watch();

  // Update form values when existingAttendance or currentDate changes
  useEffect(() => {
    setValue("amount", existingAttendance?.beer_count || 0);
    setValue("date", currentDate);
    setValue("tents", existingAttendance?.tent_ids || []);
  }, [existingAttendance, currentDate, setValue]);

  const onSubmit = async (data: DetailedAttendanceFormData) => {
    try {
      await addAttendance({ ...data, festivalId: currentFestival!.id });
      toast({
        variant: "success",
        title: "Success",
        description: "Attendance updated successfully.",
      });
      await fetchAttendanceForDate(data.date);
      onAttendanceUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update attendance. Please try again.",
      });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          Register or update your attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="column w-full">
          <label htmlFor="date">When did you visit the Wiesn?</label>
          <MyDatePicker
            name="date"
            disabled={isSubmitting}
            onDateChange={(date) => {
              setValue("date", date!);
              handleDateChange(date);
            }}
          />
          {errors.date && <span className="error">{errors.date.message}</span>}
          
          <label htmlFor="amount">How many Maße 🍻 did you have?</label>
          <select
            className={cn(
              "input w-auto self-center",
              errors.amount && "input-error",
            )}
            id="amount"
            autoComplete="off"
            {...register("amount", { valueAsNumber: true })}
          >
            {[...Array(11)].map((_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          {errors.amount && <span className="error">{errors.amount.message}</span>}
          
          <label htmlFor="tents">Which tents did you visit?</label>
          <TentSelector
            disabled={isSubmitting}
            selectedTents={watchedValues.tents}
            onTentsChange={(newTents) => {
              setValue("tents", newTents);
            }}
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
