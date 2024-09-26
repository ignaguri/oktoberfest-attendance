"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { resetPassword } from "@/lib/actions";
import cn from "classnames";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { Link } from "next-view-transitions";
import * as Yup from "yup";

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
      <h2 className="w-full text-center">Reset Password</h2>
      <Formik
        initialValues={{
          email: "",
        }}
        validationSchema={ResetPasswordSchema}
        onSubmit={handleResetPassword}
      >
        {({ errors }) => (
          <Form className="column w-full">
            <label htmlFor="email">Email</label>
            <Field
              className={cn("input", errors.email && "input-error")}
              id="email"
              name="email"
              placeholder="jane@acme.com"
              type="email"
            />
            <ErrorMessage name="email" component="span" className="error" />
            <Button type="submit" className="self-center" variant="yellow">
              Send Instructions
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
