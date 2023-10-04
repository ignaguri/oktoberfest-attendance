"use client";

import { useCallback, useEffect, useState } from "react";
import cn from "classnames";
import { Field, Form, Formik } from "formik";
import * as Yup from "yup";
import { useSupabase } from "@/lib/supabase-provider";
import { MyDatePicker } from "@/components/DatePicker";
import AttendanceTable from "@/components/AttendanceTable";
import { Database } from "@/lib/database.types";

type AttendanceDBType = Database["public"]["Tables"]["attendance"]["Row"];

export const BEGGINING_OF_WIESN = new Date("2023-09-16"); // TODO: move this to a constants file
export const END_OF_WIESN = new Date("2023-10-03");

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
  const supabase = useSupabase();
  const [errorMsg, setErrorMsg] = useState<string>();
  const [successMsg, setSuccessMsg] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [attendance, setAttendance] =
    useState<Pick<AttendanceDBType, "date" | "liters">[]>();

  const fetchAttendance = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData || !userData.user) return;

    const { data } = await supabase
      .from("attendance")
      .select("date, liters")
      .filter("user_id", "eq", userData.user.id);
    if (!data) return;
    setAttendance(data);
  }, [supabase]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  async function handleSubmit(
    formData: { amount: number; date: Date },
    { resetForm }: { resetForm: () => void }
  ) {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData || !userData.user) return;

    const { error } = await supabase.from("attendance").upsert({
      date: formData.date,
      liters: formData.amount,
      user_id: userData.user.id,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(
        "Success! You can add another day or update the amount of beers for the same day."
      );
      fetchAttendance();
    }

    setLoading(false);
    resetForm();
  }

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

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
      <AttendanceTable data={attendance} />
    </div>
  );
}
