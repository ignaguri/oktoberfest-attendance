"use client";

import cn from "classnames";
import { Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { signUp } from "./actions";

const SignUpSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

const handleSignUp = async (formData: { email: string; password: string }) => {
  await signUp(formData);
};

// TODO: use useFormStatus
const SignUp = () => (
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
            className={cn("input", errors.email && "bg-red-50")}
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
              errors.password && touched.password && "bg-red-50",
            )}
            id="password"
            name="password"
            type="password"
          />
          {errors.password && touched.password ? (
            <div className="text-red-600">{errors.password}</div>
          ) : null}

          <button className="button-inverse w-full" type="submit">
            Submit
          </button>
        </Form>
      )}
    </Formik>
    <Link href="/sign-in" className="link w-full">
      Already have an account? Sign In.
    </Link>
  </div>
);

export default SignUp;
