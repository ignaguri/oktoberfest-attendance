"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updatePassword } from "@/lib/actions";
import cn from "classnames";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { EyeOff, Eye } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

const UpdatePasswordSchema = Yup.object().shape({
  password: Yup.string().required("Required"),
});

export default function UpdatePassword() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  async function handleUpdatePassword(formData: { password: string }) {
    try {
      await updatePassword({ password: formData.password });
      toast({
        variant: "success",
        title: "Success",
        description: "Password updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "An error occurred while updating the password.",
      });
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
            <div className="relative w-full">
              <Field
                className={cn(
                  "input",
                  errors.password && touched.password && "bg-red-50",
                )}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                disabled={isSubmitting}
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
              {isSubmitting ? "Updating..." : "Update Password"}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
}
