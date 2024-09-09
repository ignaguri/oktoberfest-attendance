"use client";

import { Formik, Field, Form } from "formik";
import * as Yup from "yup";
import { joinGroup } from "./actions";

// Define validation schema
const JoinGroupSchema = Yup.object().shape({
  groupName: Yup.string().required("Group Name is required"),
  password: Yup.string().required("Password is required"),
});

export const JoinGroupForm = () => {
  const handleSubmit = async (
    values: { groupName: string; password: string },
    { setSubmitting }: any,
  ) => {
    try {
      await joinGroup(values);
    } catch (error) {
      alert(
        "There was an error joining the group. Did you enter the correct group name and password?",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ groupName: "", password: "" }}
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
            {isSubmitting ? "Joining..." : "Join Group"}
          </button>
        </Form>
      )}
    </Formik>
  );
};
