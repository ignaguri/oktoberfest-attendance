"use client";

import Link from "next/link";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { login } from "./actions";
import { useSearchParams } from "next/navigation";

const SignInSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

export default function SignIn() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const handleSubmit = async (
    values: { email: string; password: string },
    { setSubmitting, setErrors }: any,
  ) => {
    try {
      await login(values, redirect);
    } catch (error) {
      setErrors({ password: "Invalid email or password" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Sign In</h2>
      <Formik
        initialValues={{ email: "", password: "" }}
        validationSchema={SignInSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="column w-full">
            <label htmlFor="email">Email</label>
            <Field
              className={
                errors.email && touched.email ? "input-error" : "input"
              }
              id="email"
              name="email"
              placeholder="jane@acme.com"
              type="email"
            />
            <ErrorMessage name="email" component="span" className="error" />

            <label htmlFor="password">Password</label>
            <Field
              className={
                errors.password && touched.password ? "input-error" : "input"
              }
              id="password"
              name="password"
              type="password"
            />
            <ErrorMessage name="password" component="span" className="error" />

            <button
              className="button-inverse self-center"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </Form>
        )}
      </Formik>
      <Link href="/reset-password" className="link">
        Forgot your password?
      </Link>
      <Link href="/sign-up" className="link">
        Don&apos;t have an account? Sign Up.
      </Link>
    </div>
  );
}
