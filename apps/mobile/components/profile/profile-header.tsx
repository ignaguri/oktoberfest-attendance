import {
  Avatar,
  AvatarBadge,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn, getInitials } from "@prostcounter/ui";
import { Camera } from "lucide-react-native";
import React from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";

import type { Profile, UpdateProfileInput } from "@prostcounter/shared/schemas";
import type { User } from "@supabase/supabase-js";

interface ProfileHeaderProps {
  profile: Profile | null;
  user: User | null;
  isEditing: boolean;
  isAvatarUploading: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAvatarPress: () => void;
  errors: FieldErrors<UpdateProfileInput>;
  control: Control<UpdateProfileInput>;
}

export function ProfileHeader({
  profile,
  user,
  isEditing,
  isAvatarUploading,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onAvatarPress,
  errors,
  control,
}: ProfileHeaderProps) {
  const { t } = useTranslation();

  return (
    <Card
      size="lg"
      variant="elevated"
      className={cn(!isEditing && "items-center")}
    >
      <VStack space="lg" className={cn(!isEditing ? "items-center" : "w-full")}>
        <Pressable
          onPress={onAvatarPress}
          className="self-center"
          accessibilityRole="button"
          accessibilityLabel={t("profile.avatar.change")}
          accessibilityHint={t("profile.avatar.changeHint")}
        >
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
            <AvatarBadge className="bg-primary-500 items-center justify-center border-white">
              {isAvatarUploading ? (
                <Spinner size="small" color={IconColors.white} />
              ) : (
                <Camera size={16} color={IconColors.white} />
              )}
            </AvatarBadge>
          </Avatar>
        </Pressable>

        {!isEditing ? (
          <VStack space="sm" className="items-center">
            <Text className="text-typography-900 text-xl font-bold">
              {profile?.full_name || profile?.username || "User"}
            </Text>
            {profile?.username && profile?.full_name && (
              <Text className="text-typography-600 text-sm">
                @{profile.username}
              </Text>
            )}
            <Text className="text-typography-500">{user?.email}</Text>
            <Button
              variant="outline"
              action="primary"
              size="sm"
              onPress={onEdit}
              accessibilityLabel={t("profile.editButton")}
            >
              <ButtonText>{t("profile.editButton")}</ButtonText>
            </Button>
          </VStack>
        ) : (
          <VStack space="lg" className="w-full">
            {/* Email (read-only) - First position */}
            <VStack space="xs">
              <Text className="text-typography-700 text-sm font-medium">
                {t("profile.email")}
              </Text>
              <Input variant="outline" size="md" isDisabled>
                <InputField value={user?.email || ""} editable={false} />
              </Input>
            </VStack>

            {/* Username Field */}
            <VStack space="xs">
              <Text className="text-typography-700 text-sm font-medium">
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
                      accessibilityLabel={t("profile.username")}
                    />
                  </Input>
                )}
              />
              {errors.username && (
                <Text className="text-error-600 mt-1 text-sm">
                  {errors.username.message}
                </Text>
              )}
            </VStack>

            {/* Full Name Field */}
            <VStack space="xs">
              <Text className="text-typography-700 text-sm font-medium">
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
                      accessibilityLabel={t("profile.fullName")}
                    />
                  </Input>
                )}
              />
            </VStack>

            {/* Save/Cancel Buttons */}
            <HStack space="md" className="self-center">
              <Button
                variant="outline"
                action="secondary"
                onPress={onCancel}
                disabled={isSaving}
                accessibilityLabel={t("common.buttons.cancel")}
              >
                <ButtonText>{t("common.buttons.cancel")}</ButtonText>
              </Button>
              <Button
                action="primary"
                onPress={onSave}
                disabled={isSaving}
                accessibilityLabel={t("common.buttons.save")}
              >
                {isSaving ? (
                  <ButtonSpinner color={IconColors.white} />
                ) : (
                  <ButtonText>{t("common.buttons.save")}</ButtonText>
                )}
              </Button>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

ProfileHeader.displayName = "ProfileHeader";
