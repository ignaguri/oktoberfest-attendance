"use client";

import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { joinGroup } from "./actions";
import cn from "classnames";

// Define validation schema
const JoinGroupSchema = Yup.object().shape({
  groupName: Yup.string().required("Group Name is required"),
  password: Yup.string().required("Password is required"),
});

interface JoinGroupFormProps {
  groupName?: string;
  groupId?: string;
}

export const JoinGroupForm = ({ groupName, groupId }: JoinGroupFormProps) => {
  const handleSubmit = async (
    values: { groupName: string; password: string },
    { setSubmitting, setErrors }: any,
  ) => {
    try {
      await joinGroup(values);
      if (groupId) {
        // If groupId is provided, we're on the group page, so reload
        window.location.reload();
      } else {
        // Otherwise, we're on the groups page, so the existing logic will handle redirection
      }
    } catch (error) {
      setErrors({ password: "Incorrect password or unable to join group" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ groupName: groupName || "", password: "" }}
      validationSchema={JoinGroupSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting }) => (
        <Form className="space-y-2">
          <h3 className="text-xl font-semibold">Join a Group</h3>
          <Field
            type="text"
            name="groupName"
            placeholder="Group Name"
            className={cn(
              "input",
              errors.groupName && touched.groupName && "input-error",
            )}
            required
          />
          <ErrorMessage name="groupName" component="span" className="error" />
          <Field
            type="password"
            name="password"
            placeholder="Group Password"
            className={cn(
              "input",
              errors.password && touched.password && "input-error",
            )}
            required
          />
          <ErrorMessage name="password" component="span" className="error" />
          <button
            type="submit"
            className="button-inverse"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Joining..." : "Join Group"}
          </button>
        </Form>
      )}
    </Formik>
  );
};
