import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCurrentProfile,
  useUpdateProfile,
  useDeleteProfile,
  useResetTutorial,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  UpdateProfileSchema,
  type UpdateProfileInput,
} from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Alert, RefreshControl, ActionSheetIOS, Platform } from "react-native";

import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
  AvatarBadge,
} from "@/components/ui/avatar";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useBiometrics } from "@/hooks/useBiometrics";
import { useAuth } from "@/lib/auth/AuthContext";
import { getAvatarUrl } from "@/lib/utils";

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

  // Data hooks
  const {
    data: profile,
    loading: isLoading,
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
      Alert.alert(
        t("common.status.success"),
        t("profile.avatar.uploadSuccess", {
          defaultValue: "Profile picture updated",
        })
      );
    },
  });

  // Local UI state
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      username: "",
      full_name: "",
    },
  });

  // Sync form with profile data
  useEffect(() => {
    if (profile) {
      reset({
        username: profile.username || "",
        full_name: profile.full_name || "",
      });
    }
  }, [profile, reset]);

  // Refresh handler
  const onRefresh = () => {
    refetch();
  };

  // Save profile
  const onSave = async (data: UpdateProfileInput) => {
    try {
      await updateProfileMutation.mutateAsync(data);
      setIsEditing(false);
      Alert.alert(t("common.status.success"), t("profile.updateSuccess"));
    } catch (error) {
      Alert.alert(t("common.status.error"), t("profile.updateError"));
    }
  };

  // Cancel editing
  const onCancelEdit = () => {
    reset({
      username: profile?.username || "",
      full_name: profile?.full_name || "",
    });
    setIsEditing(false);
  };

  // Handle biometric toggle
  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      await enableBiometrics();
    } else {
      await disableBiometrics();
    }
  };

  // Handle reset tutorial
  const handleResetTutorial = async () => {
    try {
      await resetTutorialMutation.mutateAsync(undefined);
      Alert.alert(
        t("common.status.success"),
        t("profile.tutorial.resetSuccess", {
          defaultValue:
            "Tutorial will be shown on your next visit to the home page.",
        }),
      );
    } catch (error) {
      Alert.alert(
        t("common.status.error"),
        t("profile.tutorial.resetError", {
          defaultValue: "Failed to reset tutorial",
        }),
      );
    }
  };

  // Handle sign out
  const handleSignOut = () => {
    Alert.alert(
      t("profile.signOut.title"),
      t("profile.signOut.message"),
      [
        { text: t("common.buttons.cancel"), style: "cancel" },
        {
          text: t("profile.signOut.confirm"),
          style: "destructive",
          onPress: signOut,
        },
      ],
      { cancelable: true },
    );
  };

  // Handle delete account
  const handleDeleteAccount = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    Alert.alert(
      t("profile.deleteAccount.title"),
      t("profile.deleteAccount.finalWarning"),
      [
        {
          text: t("common.buttons.cancel"),
          style: "cancel",
          onPress: () => setShowDeleteConfirm(false),
        },
        {
          text: t("profile.deleteAccount.confirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProfileMutation.mutateAsync(undefined);
              await signOut();
            } catch (error) {
              Alert.alert(
                t("common.status.error"),
                t("profile.deleteAccount.error"),
              );
              setShowDeleteConfirm(false);
            }
          },
        },
      ],
    );
  };

  // Get biometric label
  const getBiometricLabel = () => {
    if (biometricType === "facial") return "Face ID";
    if (biometricType === "fingerprint") return "Touch ID";
    return t("profile.biometric.label");
  };

  // Handle avatar tap - show action sheet
  const handleAvatarPress = () => {
    if (isAvatarUploading) return;

    const options = [
      t("profile.avatar.takePhoto", { defaultValue: "Take Photo" }),
      t("profile.avatar.chooseFromLibrary", {
        defaultValue: "Choose from Library",
      }),
      t("common.buttons.cancel"),
    ];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          title: t("profile.avatar.change", { defaultValue: "Change Photo" }),
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            pickImage("camera");
          } else if (buttonIndex === 1) {
            pickImage("library");
          }
        }
      );
    } else {
      // Android fallback using Alert
      Alert.alert(
        t("profile.avatar.change", { defaultValue: "Change Photo" }),
        undefined,
        [
          {
            text: options[0],
            onPress: () => pickImage("camera"),
          },
          {
            text: options[1],
            onPress: () => pickImage("library"),
          },
          {
            text: options[2],
            style: "cancel",
          },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" color="#F59E0B" />
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
      <View className="p-4">
        {/* Profile Header */}
        <View className="mb-4 items-center rounded-2xl bg-white p-6 shadow-sm">
          <Pressable onPress={handleAvatarPress} className="mb-4">
            <Avatar size="2xl">
              {profile?.avatar_url ? (
                <AvatarImage source={{ uri: getAvatarUrl(profile.avatar_url) }} />
              ) : (
                <AvatarFallbackText>
                  {getInitials({
                    fullName: profile?.full_name,
                    username: profile?.username,
                    email: user?.email,
                  })}
                </AvatarFallbackText>
              )}
              <AvatarBadge className="items-center justify-center bg-primary-500 border-white">
                {isAvatarUploading ? (
                  <Spinner size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
                )}
              </AvatarBadge>
            </Avatar>
          </Pressable>

          {!isEditing ? (
            <>
              <Text className="mb-1 text-xl font-bold text-typography-900">
                {profile?.full_name || profile?.username || "User"}
              </Text>
              <Text className="mb-4 text-typography-500">{user?.email}</Text>
              <Button
                variant="outline"
                action="primary"
                size="sm"
                onPress={() => setIsEditing(true)}
              >
                <ButtonText>{t("profile.editButton")}</ButtonText>
              </Button>
            </>
          ) : (
            <View className="mt-2 w-full">
              {/* Email (read-only) - First position */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-medium text-typography-700">
                  {t("profile.email")}
                </Text>
                <Input variant="outline" size="md" isDisabled>
                  <InputField value={user?.email || ""} editable={false} />
                </Input>
              </View>

              {/* Username Field */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-medium text-typography-700">
                  {t("profile.username")}
                </Text>
                <Controller
                  control={control}
                  name="username"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      variant="outline"
                      size="md"
                      isInvalid={!!errors.username}
                    >
                      <InputField
                        placeholder={t("profile.usernamePlaceholder")}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="none"
                      />
                    </Input>
                  )}
                />
                {errors.username && (
                  <Text className="mt-1 text-sm text-error-600">
                    {errors.username.message}
                  </Text>
                )}
              </View>

              {/* Full Name Field */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-medium text-typography-700">
                  {t("profile.fullName")}
                </Text>
                <Controller
                  control={control}
                  name="full_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input variant="outline" size="md">
                      <InputField
                        placeholder={t("profile.fullNamePlaceholder")}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </Input>
                  )}
                />
              </View>

              {/* Save/Cancel Buttons */}
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  action="secondary"
                  className="flex-1"
                  onPress={onCancelEdit}
                  disabled={updateProfileMutation.loading}
                >
                  <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                </Button>
                <Button
                  action="primary"
                  className="flex-1"
                  onPress={handleSubmit(onSave)}
                  disabled={updateProfileMutation.loading}
                >
                  {updateProfileMutation.loading ? (
                    <ButtonSpinner color="#FFFFFF" />
                  ) : (
                    <ButtonText>{t("common.buttons.save")}</ButtonText>
                  )}
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* Settings Section */}
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="mb-4 text-lg font-semibold text-typography-900">
            {t("profile.settings")}
          </Text>

          {/* Biometric Authentication (if available) */}
          {isBiometricAvailable && (
            <View className="flex-row items-center justify-between border-b border-outline-100 py-3">
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons
                  name={
                    biometricType === "facial"
                      ? "face-recognition"
                      : "fingerprint"
                  }
                  size={24}
                  color="#6B7280"
                />
                <View>
                  <Text className="text-typography-900">
                    {getBiometricLabel()}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("profile.biometric.description")}
                  </Text>
                </View>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          {/* Notifications - Navigate to settings page */}
          <Pressable
            className="flex-row items-center justify-between border-b border-outline-100 py-3"
            onPress={() => router.push("/settings/notifications")}
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons
                name="bell-outline"
                size={24}
                color="#6B7280"
              />
              <View>
                <Text className="text-typography-900">
                  {t("profile.notifications.title")}
                </Text>
                <Text className="text-sm text-typography-500">
                  {t("profile.notifications.description")}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#9CA3AF"
            />
          </Pressable>

          {/* Photo Privacy - Navigate to settings page */}
          <Pressable
            className="flex-row items-center justify-between border-b border-outline-100 py-3"
            onPress={() => router.push("/settings/photo-privacy")}
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons
                name="image-outline"
                size={24}
                color="#6B7280"
              />
              <View>
                <Text className="text-typography-900">
                  {t("profile.photoPrivacy.title", {
                    defaultValue: "Photo Privacy",
                  })}
                </Text>
                <Text className="text-sm text-typography-500">
                  {t("profile.photoPrivacy.shortDescription", {
                    defaultValue: "Control who can see your photos",
                  })}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#9CA3AF"
            />
          </Pressable>

          {/* Language Display - Only English available for now */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons
                name="translate"
                size={24}
                color="#6B7280"
              />
              <Text className="text-typography-900">
                {t("profile.language")}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-typography-500">English</Text>
              {/* <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#9CA3AF"
              /> */}
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-4 shadow-sm"
          onPress={handleSignOut}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text className="font-semibold text-red-500">
            {t("profile.signOut.button")}
          </Text>
        </Pressable>

        {/* Change Password */}
        <Pressable
          className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-4 shadow-sm"
          onPress={() => router.push("/settings/change-password")}
        >
          <MaterialCommunityIcons
            name="lock-outline"
            size={20}
            color="#6B7280"
          />
          <Text className="font-semibold text-typography-700">
            {t("profile.changePassword.title", {
              defaultValue: "Change Password",
            })}
          </Text>
        </Pressable>

        {/* Tutorial Section */}
        <View className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <Text className="mb-2 text-lg font-semibold text-yellow-800">
            {t("profile.tutorial.title", { defaultValue: "Tutorial" })}
          </Text>
          <Text className="mb-4 text-sm text-yellow-700">
            {t("profile.tutorial.description", {
              defaultValue:
                "Reset the app tutorial to see it again on your next visit to the home page.",
            })}
          </Text>
          <Button
            variant="outline"
            action="secondary"
            onPress={handleResetTutorial}
            disabled={resetTutorialMutation.loading}
            className="border-yellow-400"
          >
            {resetTutorialMutation.loading ? (
              <ButtonSpinner color="#D97706" />
            ) : (
              <ButtonText className="text-yellow-700">
                {t("profile.tutorial.button", {
                  defaultValue: "Reset Tutorial",
                })}
              </ButtonText>
            )}
          </Button>
        </View>

        {/* Danger Zone - Delete Account */}
        <View className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="mb-2 text-lg font-semibold text-red-700">
            {t("profile.deleteAccount.title")}
          </Text>
          {showDeleteConfirm ? (
            <>
              <Text className="mb-4 text-sm text-red-600">
                {t("profile.deleteAccount.warning")}
              </Text>
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-red-300"
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <ButtonText className="text-red-600">
                    {t("common.buttons.cancel")}
                  </ButtonText>
                </Button>
                <Button
                  className="flex-1 bg-red-500"
                  onPress={handleDeleteAccount}
                  disabled={deleteProfileMutation.loading}
                >
                  {deleteProfileMutation.loading ? (
                    <ButtonSpinner color="#FFFFFF" />
                  ) : (
                    <ButtonText>
                      {t("profile.deleteAccount.confirm")}
                    </ButtonText>
                  )}
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text className="mb-4 text-sm text-red-600">
                {t("profile.deleteAccount.description")}
              </Text>
              <Pressable
                className="rounded-lg bg-red-500 py-3"
                onPress={handleDeleteAccount}
              >
                <Text className="text-center font-semibold text-white">
                  {t("profile.deleteAccount.button")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
