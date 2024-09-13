"use client";

import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { createGroup } from "./actions";
import cn from "classnames";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Import SVG icons
import EyeOpenIcon from "@/public/icons/eye-open.svg";
import EyeClosedIcon from "@/public/icons/eye-closed.svg";

// Define validation schema
const CreateGroupSchema = Yup.object().shape({
  groupName: Yup.string().required("Group Name is required"),
  password: Yup.string().required("Password is required"),
});

export const CreateGroupForm = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (
    values: { groupName: string; password: string },
    { setSubmitting }: any,
  ) => {
    try {
      const groupId = await createGroup(values);
      if (groupId) {
        router.push(`/group-settings/${groupId}`);
      }
    } catch (error) {
      alert(
        "There was an error creating the group. Maybe try a different name?",
      );
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
              <Image
                src={showPassword ? EyeClosedIcon : EyeOpenIcon}
                alt={showPassword ? "Hide password" : "Show password"}
                width={20}
                height={20}
              />
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
