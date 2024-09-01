"use client";

import cn from "classnames";
import { Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { login } from "./actions";

const SignInSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

const handleLogin = async (formData: { email: string; password: string }) => {
  await login(formData);
}

const SignIn = () => (
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
              errors.email && touched.email && "bg-red-50"
            )}
            id="email"
            name="email"
            placeholder="jane@acme.com"
            type="email"
          />
          {errors.email && touched.email ? (
            <div className="text-red-600">{errors.email}</div>
          ) : null}

          <label htmlFor="email">Password</label>
          <Field
            className={cn(
              "input",
              errors.password && touched.password && "bg-red-50"
            )}
            id="password"
            name="password"
            type="password"
          />
          {errors.password && touched.password ? (
            <div className="text-red-600">{errors.password}</div>
          ) : null}

          <Link href="/reset-password" className="link w-full">
            Forgot your password?
          </Link>

          <button className="button-inverse w-full" type="submit">
            Submit
          </button>
        </Form>
      )}
    </Formik>
    <Link href="/sign-up" className="link w-full">
      Don&apos;t have an account? Sign Up.
    </Link>
  </div>
);

export default SignIn;
