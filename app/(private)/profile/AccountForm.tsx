"use client";

import Avatar from "@/components/Avatar/Avatar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { profileSchema } from "@/lib/schemas/profile";
import { getProfileShort } from "@/lib/sharedActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ProfileFormData } from "@/lib/schemas/profile";
import type { User } from "@supabase/supabase-js";

import { updateProfile } from "./actions";

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullname: profileData.full_name || "",
      username: profileData.username || "",
      custom_beer_cost: profileData.custom_beer_cost || 16.2,
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile({
        id: user.id,
        ...(data.username && { username: data.username }),
        ...(data.fullname && { fullname: data.fullname }),
        ...(data.custom_beer_cost !== undefined && {
          custom_beer_cost: data.custom_beer_cost,
        }),
      });
      toast({
        variant: "success",
        title: "Success",
        description: "Profile updated successfully!",
      });
      const updatedProfile = await getProfileShort();
      setProfileData(updatedProfile);
      reset({
        fullname: updatedProfile.full_name || "",
        username: updatedProfile.username || "",
        custom_beer_cost: updatedProfile.custom_beer_cost || 16.2,
      });
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
    <div className="flex flex-col gap-6">
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
          fallback={{
            username: profileData.username,
            full_name: profileData.full_name,
            email: user.email!,
          }}
        />
        <form
          onSubmit={handleSubmit(onSubmit)}
          id="profile-data-form"
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="email" className="font-semibold">
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
              <input
                className="input"
                id="fullname"
                type="text"
                disabled={isSubmitting}
                autoComplete="off"
                {...register("fullname")}
              />
            ) : (
              <div className="p-2">
                {profileData.full_name || (
                  <span className="text-gray-500">n/a</span>
                )}
              </div>
            )}
            {errors.fullname && (
              <span className="error">{errors.fullname.message}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="username" className="font-semibold">
              Username:
            </label>
            {isEditing ? (
              <input
                className="input"
                id="username"
                type="text"
                disabled={isSubmitting}
                autoComplete="off"
                {...register("username")}
              />
            ) : (
              <div className="p-2">
                {profileData.username || (
                  <span className="text-gray-500">n/a</span>
                )}
              </div>
            )}
            {errors.username && (
              <span className="error">{errors.username.message}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="custom_beer_cost" className="font-semibold">
              Average cost of a beer (€):
            </label>
            {isEditing ? (
              <input
                className="input"
                id="custom_beer_cost"
                type="number"
                step="0.1"
                disabled={isSubmitting}
                {...register("custom_beer_cost", { valueAsNumber: true })}
              />
            ) : (
              <div className="p-2">
                {profileData.custom_beer_cost?.toFixed(2) || "16.20"}
              </div>
            )}
            {errors.custom_beer_cost && (
              <span className="error">{errors.custom_beer_cost.message}</span>
            )}
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
        </form>
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

      <NotificationSettings />
    </div>
  );
}
