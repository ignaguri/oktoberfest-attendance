"use client";

import { useState } from "react";
import cn from "classnames";
import { Field, Form, Formik } from "formik";
import * as Yup from "yup";
import { updatePassword } from "./actions";

const UpdatePasswordSchema = Yup.object().shape({
  password: Yup.string().required("Required"),
});

export default function UpdatePassword() {
  const [errorMsg, setErrorMsg] = useState<string>();
  const [successMsg, setSuccessMsg] = useState<string>();

  async function handleUpdatePassword(formData: { password: string }) {
    try {
      await updatePassword({ password: formData.password });
      setSuccessMsg("Password updated successfully.");
      setErrorMsg("");
    } catch (error: any) {
      setErrorMsg(error.message);
      setSuccessMsg("");
    }
  }

  return (
    <div className="card">
      <h2 className="w-full text-center">Update Password</h2>
      <Formik
        initialValues={{
          password: "",
        }}
        validationSchema={UpdatePasswordSchema}
        onSubmit={handleUpdatePassword}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="column w-full">
            <label htmlFor="password">New Password</label>
            <Field
              className={cn(
                "input",
                errors.password && touched.password && "bg-red-50",
              )}
              id="password"
              name="password"
              type="password"
              disabled={isSubmitting}
            />
            {errors.password && touched.password ? (
              <div className="text-red-600">{errors.password}</div>
            ) : null}
            <button
              className="button-inverse self-center"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Update Password"}
            </button>
          </Form>
        )}
      </Formik>
      {errorMsg && <div className="text-red-600">{errorMsg}</div>}
      {successMsg && <div className="text-green-600">{successMsg}</div>}
    </div>
  );
}
