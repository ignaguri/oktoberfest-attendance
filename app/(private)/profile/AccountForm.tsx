"use client";

import { useState } from "react";
import { Formik, Field, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import Avatar from "@/components/Avatar/Avatar";
import { updateProfile } from "./actions";
import { User } from "@supabase/supabase-js";

const ProfileSchema = Yup.object().shape({
  fullname: Yup.string(),
  username: Yup.string().required("Required"),
});

interface AccountFormProps {
  user: User;
  profile: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export default function AccountForm({ user, profile }: AccountFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [avatar_url, setAvatarUrl] = useState<string | null>(
    profile.avatar_url || null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleUpdateProfile(values: {
    fullname: string | null;
    username: string | null;
  }) {
    const { fullname, username } = values;
    try {
      await updateProfile({
        id: user.id,
        ...(username && { username: username }),
        ...(fullname && { fullname: fullname }),
      });
      setSuccessMsg("Profile updated!");
      setErrorMsg(null);
    } catch {
      setErrorMsg("Error updating the data!");
      setSuccessMsg(null);
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <div className="card">
      <h3 className="py-2 text-3xl font-black text-gray-800">Your Profile</h3>
      <Avatar
        className="flex flex-col items-center mb-4"
        isEditing={isEditing}
        size="large"
        uid={user.id}
        url={avatar_url}
        onUpload={(url) => {
          setAvatarUrl(url);
          handleUpdateProfile({
            fullname: profile.full_name,
            username: profile.username,
          });
        }}
      />
      <Formik
        initialValues={{
          fullname: profile.full_name || "",
          username: profile.username || "",
        }}
        enableReinitialize
        validationSchema={ProfileSchema}
        onSubmit={handleUpdateProfile}
      >
        {({ isSubmitting }) => (
          <Form id="profile-data-form" className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="fullname" className="font-semibold">
                Email:
              </label>
              <div className="p-2">
                {profile.full_name || (
                  <span className="text-gray-500">{user.email}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="fullname" className="font-semibold">
                Full&nbsp;Name:
              </label>
              {isEditing ? (
                <Field
                  className="input"
                  id="fullname"
                  name="fullname"
                  type="text"
                  disabled={isSubmitting}
                />
              ) : (
                <div className="p-2">
                  {profile.full_name || (
                    <span className="text-gray-500">n/a</span>
                  )}
                </div>
              )}
              <ErrorMessage
                name="fullname"
                component="span"
                className="error"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="username" className="font-semibold">
                Username:
              </label>
              {isEditing ? (
                <Field
                  className="input"
                  id="username"
                  name="username"
                  type="text"
                  disabled={isSubmitting}
                />
              ) : (
                <div className="p-2">
                  {profile.username || (
                    <span className="text-gray-500">n/a</span>
                  )}
                </div>
              )}
              <ErrorMessage
                name="username"
                component="span"
                className="error"
              />
            </div>
            {isEditing && (
              <div className="flex flex-col gap-2 mt-4 items-center">
                <button
                  className="button-inverse w-fit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Loading..." : "Update"}
                </button>
                <button
                  className="button w-fit"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            )}
          </Form>
        )}
      </Formik>
      {!isEditing && (
        <button
          className="button mt-4"
          type="button"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
      )}
      {errorMsg && <div className="text-red-600 mt-2">{errorMsg}</div>}
      {successMsg && <div className="text-green-600 mt-2">{successMsg}</div>}
    </div>
  );
}
