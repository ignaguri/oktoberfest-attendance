"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from "formik";
import * as Yup from "yup";
import { MyDatePicker } from "./DatePicker";
import { BEGINNING_OF_WIESN, END_OF_WIESN, TIMEZONE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import TentSelector from "@/components/TentSelector";
import { useToast } from "@/hooks/use-toast";
import {
  addAttendance,
  AttendanceByDate,
  fetchAttendanceByDate,
} from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { add, isWithinInterval } from "date-fns";
import { BeerPicturesUpload } from "./BeerPicturesUpload";
import { TZDate } from "@date-fns/tz";

const DAY_AFTER_WIESN = add(new TZDate(END_OF_WIESN, TIMEZONE), { days: 1 });

const AttendanceSchema = Yup.object().shape({
  amount: Yup.number()
    .min(0, "Beer count cannot be negative")
    .required("Required")
    .test(
      "at-least-one-tent",
      "Must select at least one tent if beer count is 0",
      function (value) {
        const { tents } = this.parent;
        return value !== 0 || (value === 0 && tents.length > 0);
      },
    ),
  date: Yup.date()
    .min(BEGINNING_OF_WIESN, "Wrong date: Wiesn hadn't started")
    .max(DAY_AFTER_WIESN, "Wrong date: Sadly it's over")
    .required("Required"),
});

interface DetailedAttendanceFormProps {
  onAttendanceUpdate: () => void;
  selectedDate: Date | null;
}

export default function DetailedAttendanceForm({
  onAttendanceUpdate,
  selectedDate,
}: DetailedAttendanceFormProps) {
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
      try {
        const attendanceData = await fetchAttendanceByDate(date);
        setExistingAttendance(attendanceData as AttendanceByDate);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch attendance data. Please try again.",
        });
      }
    },
    [toast],
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

  const handleSubmit = async (
    values: { amount: number; date: Date; tents: string[] },
    {
      setSubmitting,
    }: FormikHelpers<{ amount: number; date: Date; tents: string[] }>,
  ) => {
    setSubmitting(true);
    try {
      await addAttendance({ ...values });
      toast({
        variant: "success",
        title: "Success",
        description: "Attendance updated successfully.",
      });
      await fetchAttendanceForDate(values.date);
      onAttendanceUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update attendance. Please try again.",
      });
    } finally {
      setSubmitting(false);
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
        <Formik
          initialValues={{
            amount: existingAttendance?.beer_count || 0,
            date: currentDate,
            tents: existingAttendance?.tent_ids || [],
          }}
          validationSchema={AttendanceSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ errors, isSubmitting, setFieldValue, values }) => (
            <Form className="column w-full">
              <label htmlFor="date">When did you visit the Wiesn?</label>
              <MyDatePicker
                name="date"
                disabled={isSubmitting}
                onDateChange={(date) => {
                  setFieldValue("date", date);
                  handleDateChange(date);
                }}
              />
              <ErrorMessage name="date" component="span" className="error" />
              <label htmlFor="amount">How many Maße 🍻 did you have?</label>
              <Field
                className={cn(
                  "input w-auto self-center",
                  errors.amount && "input-error",
                )}
                id="amount"
                name="amount"
                placeholder="At least how many do you remember?"
                component="select"
                autoComplete="off"
              >
                {[...Array(11)].map((_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Field>
              <ErrorMessage name="amount" component="span" className="error" />
              <label htmlFor="tents">Which tents did you visit?</label>
              <TentSelector
                disabled={isSubmitting}
                selectedTents={values.tents}
                onTentsChange={(newTents) => {
                  setFieldValue("tents", newTents);
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
            </Form>
          )}
        </Formik>

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
