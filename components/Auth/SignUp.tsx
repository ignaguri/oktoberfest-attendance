"use client";

import React, { useState, useRef } from "react";
import cn from "classnames";
import { Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { signUp } from "./actions";

const SignUpSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Required"),
});

export default function SignUp() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSignUp = async (formData: {
    email: string;
    password: string;
  }) => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await signUp(formData);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(`Sign up failed. ${error.message}`);
      } else {
        setErrorMessage("Sign up failed. An unexpected error occurred.");
      }
      if (emailRef.current) {
        emailRef.current.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Create Account</h2>
      <Formik
        initialValues={{
          email: "",
          password: "",
        }}
        validationSchema={SignUpSchema}
        onSubmit={handleSignUp}
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
      <Link href="/sign-in" className="link">
        Already have an account? Sign In.
      </Link>
    </div>
  );
}
