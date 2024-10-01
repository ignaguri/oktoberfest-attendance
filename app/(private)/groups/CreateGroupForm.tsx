"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // Import useToast
import cn from "classnames";
import { Formik, Field, Form, ErrorMessage } from "formik";
import { EyeOff, Eye } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import * as Yup from "yup";

import { createGroup } from "./actions";

// Define validation schema
const CreateGroupSchema = Yup.object().shape({
  groupName: Yup.string().required("Group Name is required"),
  password: Yup.string().required("Password is required"),
});

export const CreateGroupForm = () => {
  const router = useTransitionRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast(); // Initialize toast

  const handleSubmit = async (
    values: { groupName: string; password: string },
    { setSubmitting }: any,
  ) => {
    try {
      const groupId = await createGroup(values);
      if (groupId) {
        router.push(`/group-settings/${groupId}`);
        toast({
          variant: "success",
          title: "Success",
          description: "Group created successfully!",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "There was an error creating the group. Maybe try a different name?",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ groupName: "", password: "" }}
      validationSchema={CreateGroupSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting }) => (
        <Form className="space-y-2 flex flex-col gap-2">
          <h3 className="text-xl font-semibold">Create a New Group</h3>
          <Field
            type="text"
            name="groupName"
            placeholder="Group Name"
            className={cn(
              "input",
              errors.groupName && touched.groupName && "input-error",
            )}
            required
            autoComplete="off"
          />
          <ErrorMessage name="groupName" component="span" className="error" />

          <div className="relative">
            <Field
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Group Password"
              className={cn(
                "input pr-10",
                errors.password && touched.password && "input-error",
              )}
              required
              autoComplete="off"
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
            type="submit"
            variant="yellow"
            className="w-fit self-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </Button>
        </Form>
      )}
    </Formik>
  );
};
