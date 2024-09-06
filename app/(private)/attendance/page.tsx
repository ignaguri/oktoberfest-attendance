"use client";

import { useCallback, useEffect, useState } from "react";
import cn from "classnames";
import { Field, Form, Formik } from "formik";
import * as Yup from "yup";
import { MyDatePicker } from "./DatePicker";
import PersonalAttendanceTable from "./PersonalAttendanceTable";
import type { Database } from "@/lib/database.types";
import { useSupabase } from "@/hooks/useSupabase";
import { BEGGINING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";

type AttendanceDBType = Database["public"]["Tables"]["attendance"]["Row"];

const AttendanceSchema = Yup.object().shape({
  amount: Yup.number()
    .min(1, "Come on! You must have drank at least one")
    .required("Required"),
  date: Yup.date()
    .min(BEGGINING_OF_WIESN, "Wiesn hadn't started")
    .max(END_OF_WIESN, "Sadly it's over")
    .required("Required"),
});

export default function AttendanceForm() {
  const { supabase, user } = useSupabase();
  const [errorMsg, setErrorMsg] = useState<string>();
  const [successMsg, setSuccessMsg] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [attendance, setAttendance] =
    useState<Pick<AttendanceDBType, "date" | "liters">[]>();

  const fetchAttendance = useCallback(async () => {
    const { data } = await supabase
      .from("attendance")
      .select("date, liters")
      .filter("user_id", "eq", user?.id)
      .order("date", { ascending: true });

    if (!data) {
      console.error("No data found");
      return;
    }

    setAttendance(data);
  }, [supabase, user]);

  async function handleSubmit(
    formData: { amount: number; date: Date },
    { resetForm }: { resetForm: () => void },
  ) {
    setLoading(true);

    if (!user) {
      setErrorMsg("You must be logged in to submit attendance");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("attendance").upsert({
      date: formData.date.toISOString(),
      liters: formData.amount,
      user_id: user.id,
    } as { date: string; liters: number; user_id: string });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(
        "Success! You can add another day or update the amount of beers for the same day.",
      );
      fetchAttendance();
    }

    setLoading(false);
    resetForm();
  }

  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
  }, [fetchAttendance, user]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <h2 className="w-full text-center">Register attendance</h2>
        <Formik
          initialValues={{ amount: 0, date: BEGGINING_OF_WIESN }}
          validationSchema={AttendanceSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched }) => (
            <Form className="column w-full">
              <label htmlFor="date">When did you go?</label>
              <MyDatePicker name="date" />
              {errors.date && touched.date ? (
                <div className="text-red-600">{`Wrong date: ${errors.date}`}</div>
              ) : null}
              <label htmlFor="amount">How many Maß did you have?</label>
              <Field
                className={cn("input", errors.amount && "bg-red-50")}
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
              {errors.amount && touched.amount ? (
                <div className="text-red-600">{errors.amount}</div>
              ) : null}
              <button
                className="button-inverse w-full"
                type="submit"
                disabled={loading}
              >
                Submit
              </button>
            </Form>
          )}
        </Formik>
        {errorMsg && <div className="text-red-600">{errorMsg}</div>}
        {successMsg && <div className="text-green-700">{successMsg}</div>}
      </div>
      <PersonalAttendanceTable data={attendance} />
    </div>
  );
}
