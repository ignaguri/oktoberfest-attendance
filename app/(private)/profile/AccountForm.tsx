"use client";

import Avatar from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getProfileShort, updateProfile } from "@/lib/actions";
import { Formik, Field, Form, ErrorMessage } from "formik";
import Link from "next/link";
import { useState } from "react";
import * as Yup from "yup";

import type { User } from "@supabase/supabase-js";

const ProfileSchema = Yup.object().shape({
  fullname: Yup.string(),
  username: Yup.string().required("Required"),
  custom_beer_cost: Yup.number()
    .min(0, "Cost must be positive")
    .max(1000, "Cost is too high")
    .nullable(),
});

interface ProfileShort {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  custom_beer_cost: number | null;
}

interface AccountFormProps {
  user: User;
  profile: ProfileShort;
}

export default function AccountForm({ user, profile }: AccountFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [avatar_url, setAvatarUrl] = useState<string | null>(
    profile.avatar_url || null,
  );
  const [profileData, setProfileData] = useState<ProfileShort>(profile);
  const { toast } = useToast();

  const handleUpdateProfile = async (values: {
    fullname: string | null;
    username: string | null;
    custom_beer_cost: number | null;
  }) => {
    const { fullname, username, custom_beer_cost } = values;
    try {
      await updateProfile({
        id: user.id,
        ...(username && { username: username }),
        ...(fullname && { fullname: fullname }),
        ...(custom_beer_cost !== null && { custom_beer_cost }),
      });
      toast({
        variant: "success",
        title: "Success",
        description: "Profile updated successfully!",
      });
      const updatedProfile = await getProfileShort();
      setProfileData(updatedProfile);
      setIsEditing(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile. Please try again.",
      });
    }
  };

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
          setIsEditing(false);
        }}
      />
      <Formik
        initialValues={{
          fullname: profileData.full_name || "",
          username: profileData.username || "",
          custom_beer_cost: profileData.custom_beer_cost || 16.2,
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
                <span className="text-gray-500">{user.email}</span>
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
                  autoComplete="off"
                />
              ) : (
                <div className="p-2">
                  {profileData.full_name || (
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
                  autoComplete="off"
                />
              ) : (
                <div className="p-2">
                  {profileData.username || (
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
            <div className="flex items-center gap-2">
              <label htmlFor="custom_beer_cost" className="font-semibold">
                Average cost of a beer (€):
              </label>
              {isEditing ? (
                <Field
                  className="input"
                  id="custom_beer_cost"
                  name="custom_beer_cost"
                  type="number"
                  step="0.1"
                  disabled={isSubmitting}
                />
              ) : (
                <div className="p-2">
                  {profileData.custom_beer_cost?.toFixed(2) || "16.20"}
                </div>
              )}
              <ErrorMessage
                name="custom_beer_cost"
                component="span"
                className="error"
              />
            </div>
            {isEditing && (
              <div className="flex flex-col gap-2 mt-4 items-center">
                <Button variant="yellow" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Loading..." : "Update"}
                </Button>
                <Button
                  variant="yellowOutline"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            )}
          </Form>
        )}
      </Formik>
      {!isEditing && (
        <div className="flex flex-col gap-4 items-center">
          <Button
            variant="yellow"
            type="button"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
          <Button variant="yellowOutline" type="button" asChild>
            <Link href="/update-password">Change Password</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
