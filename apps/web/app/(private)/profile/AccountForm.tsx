"use client";

import Avatar from "@/components/Avatar/Avatar";
import { LanguageSelector } from "@/components/LanguageSelector";
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
import { useTranslation } from "@/lib/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { changeLanguage } from "@prostcounter/shared/i18n";
import { ProfileFormSchema } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { ProfileForm } from "@prostcounter/shared/schemas";

export default function AccountForm() {
  const { t } = useTranslation();
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
  } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
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
          <p className="text-center text-gray-600">
            {t("common.status.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card">
          <p className="text-center text-red-600">
            {t("notifications.error.profileUpdateFailed")}
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ProfileForm) => {
    try {
      await updateProfileMutation({
        ...(data.username && { username: data.username }),
        ...(data.fullname && { full_name: data.fullname }),
      });
      toast.success(t("notifications.success.profileUpdated"));
      setIsEditing(false);
      // Form will be automatically reset when profile data updates via React Query
    } catch {
      toast.error(t("notifications.error.profileUpdateFailed"));
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
      toast.error(t("profile.deleteAccount.error"));
    }
  };

  const handleResetTutorial = async () => {
    try {
      await resetTutorialMutation({});
      toast.success(t("profile.tutorial.resetSuccess"));
    } catch {
      toast.error(t("notifications.error.tutorialResetFailed"));
    }
  };

  const handleLanguageChange = async (language: string | null) => {
    try {
      // Update the profile in the database
      await updateProfileMutation({ preferred_language: language });

      // Change the language immediately in i18n
      if (language) {
        await changeLanguage(language);
      } else {
        // Auto-detect and apply
        const { detectBrowserLanguage } =
          await import("@/lib/utils/detectLanguage");
        const { SUPPORTED_LANGUAGES } =
          await import("@prostcounter/shared/i18n");
        const detected = detectBrowserLanguage([
          ...SUPPORTED_LANGUAGES,
        ] as string[]);
        await changeLanguage(detected);
      }

      toast.success(t("profile.languageSettings.updateSuccess"));
    } catch {
      toast.error(t("profile.languageSettings.updateError"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="card">
        <h3 className="py-2 text-3xl font-black text-gray-800">
          {t("profile.pageTitle")}
        </h3>
        <Avatar
          className="mb-4 flex flex-col items-center"
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
              {t("common.labels.email")}:
            </Label>
            <div className="p-2">
              <span className="text-gray-500">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="fullname" className="font-semibold">
              {t("profile.account.fullNameLabel")}:
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
              {t("profile.account.usernameLabel")}:
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
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button variant="yellow" type="submit" disabled={isUpdating}>
                {isUpdating
                  ? t("common.buttons.loading")
                  : t("common.buttons.save")}
              </Button>
              <Button
                variant="yellowOutline"
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isUpdating}
              >
                {t("common.buttons.cancel")}
              </Button>
            </div>
          )}
        </form>
        {!isEditing && (
          <div className="flex flex-col items-center gap-4">
            <Button
              variant="yellow"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              {t("common.buttons.edit")}
            </Button>
            <Button variant="yellowOutline" type="button" asChild>
              <Link href="/update-password">
                {t("profile.account.changePassword")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <NotificationSettings />

      {/* Language Settings */}
      <div className="card">
        <LanguageSelector
          currentLanguage={profile.preferred_language}
          onLanguageChange={handleLanguageChange}
          disabled={isUpdating}
        />
      </div>

      {/* Location sharing disabled - requires migration from deprecated location_sharing_preferences
          table to new session-based model (location_sessions, location_session_members).
          See: app/api/location-sharing/preferences/route.ts for migration notes */}

      <PhotoPrivacySettings />

      {/* Tutorial Reset Section */}
      <div className="card bg-yellow-50">
        <div className="flex flex-col items-center gap-4">
          <h4 className="text-lg font-semibold text-gray-800">
            {t("profile.tutorial.title")}
          </h4>
          <p className="text-center text-sm text-gray-700">
            {t("profile.tutorial.description")}
          </p>
          <Button
            variant="yellowOutline"
            size="sm"
            onClick={handleResetTutorial}
            disabled={isResettingTutorial}
          >
            {isResettingTutorial
              ? t("common.buttons.loading")
              : t("profile.tutorial.resetButton")}
          </Button>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="card bg-red-500/20">
        <div className="flex flex-col items-center gap-4">
          <h4 className="text-lg font-semibold text-gray-800">
            {t("profile.sections.danger")}
          </h4>
          <p className="text-center text-sm text-gray-700">
            {t("profile.deleteAccount.warning")}
          </p>
          {showDeleteConfirm ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-sm font-medium text-red-600">
                {t("profile.deleteAccount.confirmPrompt")}
              </p>
              <ul className="list-inside list-disc text-center text-xs text-red-600">
                <li>{t("profile.deleteAccount.dataList.consumption")}</li>
                <li>{t("profile.deleteAccount.dataList.photos")}</li>
                <li>{t("profile.deleteAccount.dataList.groups")}</li>
                <li>{t("profile.deleteAccount.dataList.profile")}</li>
              </ul>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? t("common.buttons.loading")
                    : t("profile.deleteAccount.confirmButton")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  {t("common.buttons.cancel")}
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
              {t("profile.deleteAccount.button")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
