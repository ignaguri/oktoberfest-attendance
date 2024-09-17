"use client";

import { useState } from "react";
import Link from "next/link";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { login } from "@/lib/actions";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EyeOff, Eye } from "lucide-react";

const SignInSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

export default function SignIn() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [showPassword, setShowPassword] = useState(false);

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
            <div className="relative w-full">
              <Field
                className={
                  errors.password && touched.password ? "input-error" : "input"
                }
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute h-full inset-y-0 right-0 flex items-center text-gray-400 cursor-pointer pr-2"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </Button>
            </div>
            <ErrorMessage name="password" component="span" className="error" />

            <Button
              variant="yellow"
              className="self-center"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
          </Form>
        )}
      </Formik>
      <div className="flex flex-col gap-2">
        <Button variant="link" asChild>
          <Link href="/reset-password">Forgot your password?</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/sign-up">Don&apos;t have an account? Sign Up.</Link>
        </Button>
      </div>
    </div>
  );
}
