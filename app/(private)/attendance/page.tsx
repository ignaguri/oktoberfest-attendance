"use client";

import { useCallback, useEffect, useState } from "react";
import cn from "classnames";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import { MyDatePicker } from "./DatePicker";
import PersonalAttendanceTable from "./PersonalAttendanceTable";
import type { Tables } from "@/lib/database.types";
import { useSupabase } from "@/hooks/useSupabase";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";
import { isWithinInterval } from "date-fns/isWithinInterval";

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
  const { supabase, user } = useSupabase();
  const [attendance, setAttendance] =
    useState<Pick<AttendanceDBType, "date" | "beer_count">[]>();

  const fetchAttendances = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const { data, error } = await supabase
      .from("attendances")
      .select("*")
      .eq("user_id", user?.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching profile", error);
      return;
    }

    if (data) {
      setAttendance(data);
    }
  }, [supabase, user]);

  async function handleSubmit(
    formData: { amount: number; date: Date },
    { setStatus }: { setStatus: (status?: any) => void },
  ) {
    if (!user) {
      setStatus({
        error: true,
        msg: "You must be logged in to submit attendance",
      });
      return;
    }

    const { error } = await supabase.from("attendances").upsert(
      {
        user_id: user.id,
        date: formData.date.toISOString(),
        beer_count: formData.amount,
      },
      {
        onConflict: "date",
      },
    );

    if (error) {
      setStatus({
        error: true,
        msg: "Error submitting attendance",
      });
    } else {
      setStatus({
        error: false,
        msg: "Success! You can add another day or update the amount of beers for the same day.",
      });
      fetchAttendances();
    }
  }

  useEffect(() => {
    if (user) {
      fetchAttendances();
    }
  }, [fetchAttendances, user]);

  return (
    <div className="max-w-lg sm:w-full flex flex-col gap-6">
      <div className="card">
        <h2 className="w-full text-center">Register attendance</h2>
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
          initialStatus={{ error: false, msg: "" }}
        >
          {({ errors, isSubmitting, status }) => (
            <Form className="column w-full">
              <label htmlFor="date">When did you go?</label>
              <MyDatePicker name="date" />
              <ErrorMessage
                name="date"
                component="span"
                className="text-red-600 my-2 self-center"
              />
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
                className="text-red-600 my-2 self-center"
              />
              <button
                className="button-inverse self-center"
                type="submit"
                disabled={isSubmitting}
              >
                Submit
              </button>
              {status.msg && (
                <div
                  className={cn(
                    status.error && "text-red-600",
                    !status.error && "text-green-700",
                  )}
                >
                  {status.msg}
                </div>
              )}
            </Form>
          )}
        </Formik>
      </div>
      <PersonalAttendanceTable data={attendance} />
    </div>
  );
}
