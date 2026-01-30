import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCurrentProfile,
  useDeleteProfile,
  useResetTutorial,
  useUpdateProfile,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  type UpdateProfileInput,
  UpdateProfileSchema,
} from "@prostcounter/shared/schemas";
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { Lock, LogOut, Puzzle } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { RefreshControl } from "react-native";

import { ImageSourcePicker } from "@/components/image-source-picker";
import { DangerZone } from "@/components/profile/danger-zone";
import { ProfileHeader } from "@/components/profile/profile-header";
import { SettingsSection } from "@/components/profile/settings-section";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Heading } from "@/components/ui/heading";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useBiometrics } from "@/hooks/useBiometrics";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    isAvailable: isBiometricAvailable,
    biometricType,
    isEnabled: isBiometricEnabled,
    enableBiometrics,
    disableBiometrics,
  } = useBiometrics();

  // Dialog state (using reusable hook)
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Data hooks
  const {
    data: profile,
    loading: isLoading,
    error: profileError,
    refetch,
    isRefetching = false,
  } = useCurrentProfile();
  const updateProfileMutation = useUpdateProfile();
  const deleteProfileMutation = useDeleteProfile();
  const resetTutorialMutation = useResetTutorial();

  // Avatar upload
  const { pickImage, isUploading: isAvatarUploading } = useAvatarUpload({
    onSuccess: () => {
      refetch();
      showDialog(t("common.status.success"), t("profile.avatar.uploadSuccess"));
    },
    onError: () => {
      showDialog(t("common.status.error"), t("profile.avatar.uploadError"));
    },
  });

  // Local UI state
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);

  // Form - using values option instead of useEffect for syncing
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    values: profile
      ? {
          username: profile.username || "",
          full_name: profile.full_name || "",
        }
      : undefined,
  });

  // Memoized handlers
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const onSave = useCallback(
    async (data: UpdateProfileInput) => {
      try {
        await updateProfileMutation.mutateAsync(data);
        setIsEditing(false);
        showDialog(t("common.status.success"), t("profile.updateSuccess"));
      } catch {
        showDialog(t("common.status.error"), t("profile.updateError"));
      }
    },
    [updateProfileMutation, showDialog, t],
  );

  const onCancelEdit = useCallback(() => {
    reset({
      username: profile?.username || "",
      full_name: profile?.full_name || "",
    });
    setIsEditing(false);
  }, [reset, profile]);

  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        await enableBiometrics();
      } else {
        await disableBiometrics();
      }
    },
    [enableBiometrics, disableBiometrics],
  );

  const handleResetTutorial = useCallback(async () => {
    try {
      await resetTutorialMutation.mutateAsync(undefined);
      showDialog(
        t("common.status.success"),
        t("profile.tutorial.resetSuccess"),
      );
    } catch {
      showDialog(t("common.status.error"), t("profile.tutorial.resetError"));
    }
  }, [resetTutorialMutation, showDialog, t]);

  const handleSignOut = useCallback(() => {
    showDialog(
      t("profile.signOut.title"),
      t("profile.signOut.message"),
      "destructive",
      async () => {
        try {
          await signOut();
        } catch {
          showDialog(t("common.status.error"), t("profile.signOut.error"));
        }
      },
    );
  }, [showDialog, signOut, t]);

  const handleDeleteAccount = useCallback(() => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    showDialog(
      t("profile.deleteAccount.title"),
      t("profile.deleteAccount.finalWarning"),
      "destructive",
      async () => {
        try {
          await deleteProfileMutation.mutateAsync(undefined);
          await signOut();
        } catch {
          showDialog(
            t("common.status.error"),
            t("profile.deleteAccount.error"),
          );
          setShowDeleteConfirm(false);
        }
      },
    );
  }, [showDeleteConfirm, showDialog, deleteProfileMutation, signOut, t]);

  const handleAvatarPress = useCallback(() => {
    if (isAvatarUploading) return;
    setShowAvatarSheet(true);
  }, [isAvatarUploading]);

  const handleAvatarOption = useCallback(
    (option: "camera" | "library") => {
      pickImage(option);
    },
    [pickImage],
  );

  const handleCancelDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleCloseAvatarSheet = useCallback(() => {
    setShowAvatarSheet(false);
  }, []);

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ErrorState error={profileError} onRetry={refetch} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
      }
    >
      <VStack space="lg" className="p-4">
        {/* Profile Header */}
        <ProfileHeader
          profile={profile}
          user={user}
          isEditing={isEditing}
          isAvatarUploading={isAvatarUploading}
          isSaving={updateProfileMutation.loading}
          onEdit={handleStartEditing}
          onSave={handleSubmit(onSave)}
          onCancel={onCancelEdit}
          onAvatarPress={handleAvatarPress}
          errors={errors}
          control={control}
        />

        {/* Settings Section */}
        <SettingsSection
          isBiometricAvailable={isBiometricAvailable}
          biometricType={biometricType}
          isBiometricEnabled={isBiometricEnabled}
          onBiometricToggle={handleBiometricToggle}
        />

        {/* Sign Out & Change Password */}
        <Card size="md" variant="ghost">
          <VStack space="lg" className="items-center">
            <Button
              variant="solid"
              action="negative"
              onPress={handleSignOut}
              accessibilityLabel={t("profile.signOut.button")}
            >
              <LogOut size={20} color={IconColors.white} />
              <ButtonText>{t("profile.signOut.button")}</ButtonText>
            </Button>

            <Button
              variant="solid"
              action="secondary"
              onPress={() => router.push("/settings/change-password")}
              accessibilityLabel={t("profile.changePassword.title")}
            >
              <Lock size={20} color={IconColors.default} />
              <ButtonText>{t("profile.changePassword.title")}</ButtonText>
            </Button>
          </VStack>
        </Card>

        {/* Tutorial Section */}
        <Card
          size="md"
          variant="outline"
          className="border-yellow-200 bg-yellow-50"
        >
          <VStack space="md" className="items-center">
            <Text className="text-lg font-semibold text-yellow-800">
              {t("profile.tutorial.title")}
            </Text>
            <Text className="text-center text-sm text-yellow-700">
              {t("profile.tutorial.description")}
            </Text>
            <Button
              variant="outline"
              action="secondary"
              onPress={handleResetTutorial}
              disabled={resetTutorialMutation.loading}
              className="border-yellow-400"
              accessibilityLabel={t("profile.tutorial.button")}
            >
              {resetTutorialMutation.loading ? (
                <ButtonSpinner color={Colors.primary[600]} />
              ) : (
                <ButtonText className="text-yellow-700">
                  {t("profile.tutorial.button")}
                </ButtonText>
              )}
            </Button>
          </VStack>
        </Card>

        {/* Dev-only Components Showcase Link */}
        {__DEV__ && (
          <Card
            size="md"
            variant="outline"
            className="border-purple-200 bg-purple-50"
          >
            <VStack space="md" className="items-center">
              <Text className="text-lg font-semibold text-purple-800">
                {t("dev.title")}
              </Text>
              <Text className="text-center text-sm text-purple-700">
                {t("dev.description")}
              </Text>
              <Button
                variant="outline"
                action="secondary"
                onPress={() => router.push("/(dev)/components")}
                className="border-purple-400"
                accessibilityLabel={t("dev.components.openShowcase")}
              >
                <Puzzle size={18} color="#7c3aed" />
                <ButtonText className="text-purple-700">
                  {t("dev.components.showcase")}
                </ButtonText>
              </Button>
            </VStack>
          </Card>
        )}

        {/* Danger Zone - Delete Account */}
        <DangerZone
          showDeleteConfirm={showDeleteConfirm}
          isDeleting={deleteProfileMutation.loading}
          onDeletePress={handleDeleteAccount}
          onCancelDelete={handleCancelDeleteConfirm}
        />

        {/* App Version */}
        <Text className="text-center text-xs text-typography-400">
          v{Application.nativeApplicationVersion} (
          {Application.nativeBuildVersion})
        </Text>
      </VStack>

      {/* Avatar Picker */}
      <ImageSourcePicker
        isOpen={showAvatarSheet}
        onClose={handleCloseAvatarSheet}
        onSelect={handleAvatarOption}
        disabled={isAvatarUploading}
      />

      {/* Gluestack AlertDialog */}
      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading
              size="lg"
              className={
                dialog.type === "destructive"
                  ? "text-error-600"
                  : "text-typography-950"
              }
            >
              {dialog.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {dialog.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            {dialog.onConfirm ? (
              <>
                <Button
                  variant="outline"
                  action="secondary"
                  onPress={closeDialog}
                  className="flex-1"
                >
                  <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                </Button>
                <Button
                  action={
                    dialog.type === "destructive" ? "negative" : "primary"
                  }
                  onPress={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  className="flex-1"
                >
                  <ButtonText>
                    {dialog.type === "destructive"
                      ? t("common.buttons.confirm")
                      : t("common.buttons.ok")}
                  </ButtonText>
                </Button>
              </>
            ) : (
              <Button action="primary" onPress={closeDialog} className="flex-1">
                <ButtonText>{t("common.buttons.ok")}</ButtonText>
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
}
