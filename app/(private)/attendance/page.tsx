"use client";

import { useCallback, useEffect, useState } from "react";
import cn from "classnames";
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from "formik";
import * as Yup from "yup";
import { MyDatePicker } from "./DatePicker";
import PersonalAttendanceTable from "./PersonalAttendanceTable";
import type { Tables } from "@/lib/database.types";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";
import { isWithinInterval } from "date-fns/isWithinInterval";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { addAttendance, fetchAttendances } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AttendanceDBType = Tables<"attendances">;

const AttendanceSchema = Yup.object().shape({
  amount: Yup.number()
    .min(1, "Come on! You must have drank at least one")
    .required("Required"),
  date: Yup.date()
    .min(BEGINNING_OF_WIESN, "Wrong date: Wiesn hadn't started")
    .max(END_OF_WIESN, "Wrong date: Sadly it's over")
    .required("Required"),
});

export default function AttendanceForm() {
  const [attendance, setAttendance] =
    useState<Pick<AttendanceDBType, "date" | "beer_count">[]>();

  const fetchAttendancesCbk = useCallback(async () => {
    const data = await fetchAttendances();
    setAttendance(data);
  }, []);

  const { toast } = useToast();

  const handleSubmit = async (
    values: { amount: number; date: Date },
    { setSubmitting, resetForm }: FormikHelpers<{ amount: number; date: Date }>,
  ) => {
    setSubmitting(true);
    try {
      await addAttendance(values);
      toast({
        variant: "success",
        title: "Success",
        description:
          "You can add another day or update the amount of beers for the same day.",
      });
      resetForm();
      await fetchAttendancesCbk();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to register attendance. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchAttendancesCbk();
  }, [fetchAttendancesCbk]);

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            Register your attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Formik
            initialValues={{
              amount: 0,
              date: isWithinInterval(new Date(), {
                start: BEGINNING_OF_WIESN,
                end: END_OF_WIESN,
              })
                ? new Date()
                : BEGINNING_OF_WIESN,
            }}
            validationSchema={AttendanceSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, isSubmitting }) => (
              <Form className="column w-full">
                <label htmlFor="date">When did you go?</label>
                <MyDatePicker name="date" />
                <ErrorMessage name="date" component="span" className="error" />
                <label htmlFor="amount">How many Maße 🍻 did you have?</label>
                <Field
                  className={cn(
                    "input w-auto self-center",
                    errors.amount && "bg-red-50 border-red-200",
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
                <ErrorMessage
                  name="amount"
                  component="span"
                  className="error"
                />
                <Button
                  variant="yellowOutline"
                  className="self-center"
                  type="submit"
                  disabled={isSubmitting}
                >
                  Submit
                </Button>
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>
      <PersonalAttendanceTable data={attendance} />
    </div>
  );
}
