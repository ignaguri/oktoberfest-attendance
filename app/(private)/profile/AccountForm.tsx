"use client";

import Avatar from "@/components/Avatar/Avatar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPrivacySettings } from "@/components/ui/photo-privacy-settings";
import { useToast } from "@/hooks/use-toast";
import { profileSchema } from "@/lib/schemas/profile";
import { getProfileShort, resetTutorial } from "@/lib/sharedActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ProfileFormData } from "@/lib/schemas/profile";
import type { User } from "@supabase/supabase-js";

import { updateProfile, deleteAccount } from "./actions";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isResettingTutorial, setIsResettingTutorial] = useState(false);
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

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount();
    } catch (error) {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Failed to delete account. Please try again or contact support.",
      });
    }
  };

  const handleResetTutorial = async () => {
    try {
      setIsResettingTutorial(true);
      await resetTutorial();
      toast({
        variant: "success",
        title: "Tutorial Reset",
        description:
          "The tutorial has been reset. You'll see it again when you visit the home page.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset tutorial. Please try again.",
      });
    } finally {
      setIsResettingTutorial(false);
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
            <Label htmlFor="email" className="font-semibold">
              Email:
            </Label>
            <div className="p-2">
              <span className="text-gray-500">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="fullname" className="font-semibold">
              Full&nbsp;Name:
            </Label>
            {isEditing ? (
              <Input
                className="input"
                id="fullname"
                type="text"
                disabled={isSubmitting}
                autoComplete="off"
                errorMsg={errors.fullname?.message}
                {...register("fullname")}
              />
            ) : (
              <div className="p-2">
                {profileData.full_name || (
                  <span className="text-gray-500">n/a</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="username" className="font-semibold">
              Username:
            </Label>
            {isEditing ? (
              <Input
                className="input"
                id="username"
                type="text"
                disabled={isSubmitting}
                autoComplete="off"
                errorMsg={errors.username?.message}
                {...register("username")}
              />
            ) : (
              <div className="p-2">
                {profileData.username || (
                  <span className="text-gray-500">n/a</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="custom_beer_cost" className="font-semibold">
              Average cost of a beer (€):
            </Label>
            {isEditing ? (
              <Input
                className="input"
                id="custom_beer_cost"
                type="number"
                step="0.1"
                disabled={isSubmitting}
                errorMsg={errors.custom_beer_cost?.message}
                {...register("custom_beer_cost", { valueAsNumber: true })}
              />
            ) : (
              <div className="p-2">
                {profileData.custom_beer_cost?.toFixed(2) || "16.20"}
              </div>
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

      <PhotoPrivacySettings />

      {/* Tutorial Reset Section */}
      <div className="card bg-yellow-50">
        <div className="flex flex-col items-center gap-4">
          <h4 className="text-lg font-semibold text-gray-800">Tutorial</h4>
          <p className="text-sm text-gray-700 text-center">
            Reset the app tutorial to see it again on your next visit to the
            home page.
          </p>
          <Button
            variant="yellowOutline"
            size="sm"
            onClick={handleResetTutorial}
            disabled={isResettingTutorial}
          >
            {isResettingTutorial ? "Resetting..." : "Reset Tutorial"}
          </Button>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="card bg-red-500/20">
        <div className="flex flex-col items-center gap-4">
          <h4 className="text-lg font-semibold text-gray-800">Danger Zone</h4>
          <p className="text-sm text-gray-700 text-center">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          {showDeleteConfirm ? (
            <div className="flex flex-col gap-2 items-center">
              <p className="text-sm text-red-600 font-medium text-center">
                Are you sure? This will permanently delete all your data
                including:
              </p>
              <ul className="text-xs text-red-600 text-center list-disc list-inside">
                <li>All your beer consumption records</li>
                <li>Photos and tent visits</li>
                <li>Group memberships and achievements</li>
                <li>Profile information</li>
              </ul>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              Delete Account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
