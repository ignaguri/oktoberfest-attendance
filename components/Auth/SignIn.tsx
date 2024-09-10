"use client";

import React, { useState, useRef } from "react";
import cn from "classnames";
import { Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { login } from "./actions";

const SignInSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

export default function SignIn() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (formData: { email: string; password: string }) => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await login(formData);
    } catch (error) {
      setErrorMessage("Login failed. Please try again.");
      if (emailRef.current) {
        emailRef.current.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Sign In</h2>
      <Formik
        initialValues={{
          email: "",
          password: "",
        }}
        validationSchema={SignInSchema}
        onSubmit={handleLogin}
      >
        {({ errors, touched }) => (
          <Form className="column w-full">
            <label htmlFor="email">Email</label>
            <Field
              className={cn(
                "input",
                errors.email && touched.email && "bg-red-50",
              )}
              id="email"
              name="email"
              placeholder="jane@acme.com"
              type="email"
              innerRef={emailRef}
              disabled={isSubmitting}
            />
            {errors.email && touched.email ? (
              <div className="text-red-600">{errors.email}</div>
            ) : null}

            <label htmlFor="password">Password</label>
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
              Submit
            </button>
            {errorMessage && (
              <p className="text-red-600 mt-2 self-center">{errorMessage}</p>
            )}
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
