"use client";

import { Formik, Field, Form } from "formik";
import * as Yup from "yup";
import { createGroup } from "./actions";

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
      alert("There was an error creating the group. Please try again.");
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
            className="w-full p-2 border rounded-lg"
            required
          />
          {errors.groupName && touched.groupName ? (
            <div className="text-red-600">{errors.groupName}</div>
          ) : null}
          <Field
            type="password"
            name="password"
            placeholder="Group Password"
            className="w-full p-2 border rounded-lg"
            required
          />
          {errors.password && touched.password ? (
            <div className="text-red-600">{errors.password}</div>
          ) : null}
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
