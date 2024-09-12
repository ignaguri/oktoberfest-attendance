"use client";

import cn from "classnames";
import { Field, Form, Formik } from "formik";
import Link from "next/link";
import * as Yup from "yup";
import { resetPassword } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ResetPasswordSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
});

const ResetPassword = () => {
  const { toast } = useToast();

  const handleResetPassword = async (formData: { email: string }) => {
    const [_, errorMessage] = await resetPassword(formData);

    if (errorMessage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } else {
      toast({
        variant: "success",
        title: "Success",
        description: "Instructions sent. Check your email.",
      });
    }
  };

  return (
    <div className="card">
      <h2 className="w-full text-center">Forgot Password</h2>
      <Formik
        initialValues={{
          email: "",
        }}
        validationSchema={ResetPasswordSchema}
        onSubmit={handleResetPassword}
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
            <Button variant="yellow" asChild>
              <Link href="/reset-password" className="link">
                Send Instructions
              </Link>
            </Button>
          </Form>
        )}
      </Formik>
      <Button asChild variant="link">
        <Link href="/sign-in">Remember your password? Sign In.</Link>
      </Button>
    </div>
  );
};

export default ResetPassword;
