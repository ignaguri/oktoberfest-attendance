import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import React from "react";

import type { BiometricType } from "@/hooks/useBiometrics";

interface SettingsSectionProps {
  isBiometricAvailable: boolean;
  biometricType: BiometricType;
  isBiometricEnabled: boolean;
  onBiometricToggle: (value: boolean) => void;
}

export function SettingsSection({
  isBiometricAvailable,
  biometricType,
  isBiometricEnabled,
  onBiometricToggle,
}: SettingsSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const getBiometricLabel = () => {
    if (biometricType === "facial") return "Face ID";
    if (biometricType === "fingerprint") return "Touch ID";
    return t("profile.biometric.label");
  };

  const biometricLabel = getBiometricLabel();

  return (
    <Card size="md" variant="elevated">
      <Text className="mb-4 text-lg font-semibold text-typography-900">
        {t("profile.settings")}
      </Text>

      {/* Biometric Authentication (if available) */}
      {isBiometricAvailable && (
        <View className="flex-row items-center justify-between border-b border-outline-100 py-3">
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons
              name={
                biometricType === "facial" ? "face-recognition" : "fingerprint"
              }
              size={24}
              color="#6B7280"
            />
            <View>
              <Text className="text-typography-900">{biometricLabel}</Text>
              <Text className="text-sm text-typography-500">
                {t("profile.biometric.description")}
              </Text>
            </View>
          </View>
          <Switch
            value={isBiometricEnabled}
            onValueChange={onBiometricToggle}
            trackColor={{ false: "#D1D5DB", true: "#F59E0B" }}
            thumbColor="#FFFFFF"
            accessibilityLabel={`${biometricLabel} ${isBiometricEnabled ? t("common.status.enabled", { defaultValue: "enabled" }) : t("common.status.disabled", { defaultValue: "disabled" })}`}
          />
        </View>
      )}

      {/* Notifications - Navigate to settings page */}
      <Pressable
        className="flex-row items-center justify-between border-b border-outline-100 py-3"
        onPress={() => router.push("/settings/notifications")}
        accessibilityRole="button"
        accessibilityLabel={t("profile.notifications.title")}
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
        accessibilityRole="button"
        accessibilityLabel={t("profile.photoPrivacy.title", {
          defaultValue: "Photo Privacy",
        })}
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
          <MaterialCommunityIcons name="translate" size={24} color="#6B7280" />
          <Text className="text-typography-900">{t("profile.language")}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-typography-500">English</Text>
        </View>
      </View>
    </Card>
  );
}

SettingsSection.displayName = "SettingsSection";
