"use client";

import Avatar from "@/components/Avatar/Avatar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { LocationPrivacySettings } from "@/components/ui/location-privacy-settings";
import { PhotoPrivacySettings } from "@/components/ui/photo-privacy-settings";
import { useDeleteProfile, useResetTutorial } from "@/hooks/useProfile";
import {
  useCurrentProfile,
  useCurrentUser,
  useUpdateProfile,
} from "@/lib/data";
import { profileSchema } from "@/lib/schemas/profile";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "next-view-transitions";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { ProfileFormData } from "@/lib/schemas/profile";

export default function AccountForm() {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Use React Query hooks
  const { data: user, loading: userLoading } = useCurrentUser();
  const { data: profile, loading: profileLoading } = useCurrentProfile();
  const { mutate: updateProfileMutation, loading: isUpdating } =
    useUpdateProfile();
  const { mutate: resetTutorialMutation, loading: isResettingTutorial } =
    useResetTutorial();
  const { mutateAsync: deleteProfile, loading: isDeleting } =
    useDeleteProfile();

  const [avatar_url, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url || null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullname: "",
      username: "",
    },
  });

  // Reset form values when profile data becomes available
  useEffect(() => {
    if (profile) {
      reset({
        fullname: profile.full_name || "",
        username: profile.username || "",
      });
    }
  }, [profile, reset]);

  // Show loading state
  if (userLoading || profileLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card">
          <p className="text-center text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card">
          <p className="text-center text-red-600">
            Failed to load profile data.
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfileMutation({
        ...(data.username && { username: data.username }),
        ...(data.fullname && { full_name: data.fullname }),
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      // Form will be automatically reset when profile data updates via React Query
    } catch {
      toast.error("Failed to update profile. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      await deleteProfile(undefined);
      // The API doesn't redirect, so we need to navigate manually
      window.location.href = "/";
    } catch {
      setShowDeleteConfirm(false);
      toast.error(
        "Failed to delete account. Please try again or contact support.",
      );
    }
  };

  const handleResetTutorial = async () => {
    try {
      await resetTutorialMutation({});
      toast.success(
        "The tutorial has been reset. You'll see it again when you visit the home page.",
      );
    } catch {
      toast.error("Failed to reset tutorial. Please try again.");
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
          onEdit={() => setIsEditing(true)}
          onUpload={(url) => {
            setAvatarUrl(url);
            setIsEditing(false);
          }}
          fallback={{
            username: profile.username,
            full_name: profile.full_name,
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
                disabled={isUpdating}
                autoComplete="off"
                errorMsg={errors.fullname?.message}
                {...register("fullname")}
              />
            ) : (
              <div className="p-2">
                {profile.full_name || (
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
                disabled={isUpdating}
                autoComplete="off"
                errorMsg={errors.username?.message}
                {...register("username")}
              />
            ) : (
              <div className="p-2">
                {profile.username || <span className="text-gray-500">n/a</span>}
              </div>
            )}
          </div>
          {isEditing && (
            <div className="flex flex-col gap-2 mt-4 items-center">
              <Button variant="yellow" type="submit" disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update"}
              </Button>
              <Button
                variant="yellowOutline"
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isUpdating}
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

      {/* Location sharing disabled - requires migration from deprecated location_sharing_preferences
          table to new session-based model (location_sessions, location_session_members).
          See: app/api/location-sharing/preferences/route.ts for migration notes */}

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
