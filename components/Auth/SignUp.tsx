"use client";

import React, { useState, useRef } from "react";
import cn from "classnames";
import { ErrorMessage, Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { signUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SignUpSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Required"),
});

export default function SignUp() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSignUp = async (formData: {
    email: string;
    password: string;
  }) => {
    setIsSubmitting(true);
    try {
      await signUp(formData);
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Sign up failed.",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign up failed.",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      }
      if (emailRef.current) {
        emailRef.current.focus();
      }
    } finally {
      setIsSubmitting(false);
      setIsAccountCreated(true);
    }
  };

  if (isAccountCreated) {
    return (
      <div className="card">
        <h2 className="w-full text-center">Account created</h2>
        <div className="flex flex-col items-center gap-6">
          <p>Please check your email for verification.</p>
          <Button asChild variant="yellow">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

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
            <ErrorMessage name="email" component="span" className="error" />

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
            <ErrorMessage name="password" component="span" className="error" />

            <Button
              className="self-center"
              type="submit"
              variant="yellow"
              disabled={isSubmitting}
            >
              Submit
            </Button>
          </Form>
        )}
      </Formik>
      <Button asChild variant="link">
        <Link href="/sign-in">Already have an account? Sign In.</Link>
      </Button>
    </div>
  );
}
