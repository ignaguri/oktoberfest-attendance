"use client";

import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { createGroup } from "./actions";
import cn from "classnames";

// Define validation schema
const CreateGroupSchema = Yup.object().shape({
  groupName: Yup.string().required("Group Name is required"),
  password: Yup.string().required("Password is required"),
});

export const CreateGroupForm = () => {
  const handleSubmit = async (
    values: { groupName: string; password: string },
    { setSubmitting }: any,
  ) => {
    try {
      await createGroup(values);
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
        <Form className="space-y-2">
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
            {isSubmitting ? "Creating..." : "Create Group"}
          </button>
        </Form>
      )}
    </Formik>
  );
};
