import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors, SwitchColors, Colors } from "@/lib/constants/colors";
import { useFestival, type Festival } from "@/lib/festival/FestivalContext";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { format, parseISO } from "date-fns";
import { useRouter } from "expo-router";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Fingerprint,
  Image as ImageIcon,
  Languages,
  ScanFace,
} from "lucide-react-native";
import React, { useState, useCallback } from "react";

import type { BiometricType } from "@/hooks/useBiometrics";

interface SettingsSectionProps {
  isBiometricAvailable: boolean;
  biometricType: BiometricType;
  isBiometricEnabled: boolean;
  onBiometricToggle: (value: boolean) => void;
}

const getFestivalStatus = (
  festival: Festival,
): "upcoming" | "active" | "ended" => {
  const now = new Date();
  // Use parseISO to avoid UTC timezone issues with date-only strings
  const start = parseISO(festival.startDate);
  const end = parseISO(festival.endDate);

  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
};

const getStatusBadgeStyles = (status: "upcoming" | "active" | "ended") => {
  if (status === "active") {
    return { badgeClass: "bg-green-600", textClass: "text-green-100" };
  }
  if (status === "upcoming") {
    return { badgeClass: "bg-blue-500", textClass: "text-blue-100" };
  }
  return { badgeClass: "bg-gray-400", textClass: "text-gray-100" };
};

export function SettingsSection({
  isBiometricAvailable,
  biometricType,
  isBiometricEnabled,
  onBiometricToggle,
}: SettingsSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();
  const [showFestivalSheet, setShowFestivalSheet] = useState(false);

  const getBiometricLabel = () => {
    if (biometricType === "facial") return "Face ID";
    if (biometricType === "fingerprint") return "Touch ID";
    return t("profile.biometric.label");
  };

  const biometricLabel = getBiometricLabel();

  const handleFestivalSelect = useCallback(
    (festival: Festival) => {
      setCurrentFestival(festival);
      setShowFestivalSheet(false);
    },
    [setCurrentFestival],
  );

  return (
    <Card size="md" variant="elevated">
      <Text className="mb-4 text-lg font-semibold text-typography-900">
        {t("profile.settings")}
      </Text>

      {/* Festival Selector */}
      <Pressable
        className="flex-row items-center justify-between border-b border-outline-100 py-3"
        onPress={() => setShowFestivalSheet(true)}
        accessibilityRole="button"
        accessibilityLabel={t("festival.selector.title")}
      >
        <View className="flex-row items-center gap-3">
          <CalendarDays size={24} color={IconColors.primary} />
          <View>
            <Text className="text-typography-900">
              {t("festival.selector.title")}
            </Text>
            <Text className="text-sm text-typography-500">
              {currentFestival?.name || t("festival.selector.noFestival")}
            </Text>
          </View>
        </View>
        <ChevronRight size={24} color={IconColors.muted} />
      </Pressable>

      {/* Festival Selection Sheet */}
      <Actionsheet
        isOpen={showFestivalSheet}
        onClose={() => setShowFestivalSheet(false)}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent className="pb-8">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="md" className="w-full px-4 pt-4">
            <Heading size="md" className="text-center">
              {t("festival.selector.title")}
            </Heading>
            <Text className="text-center text-sm text-typography-500">
              {t("festival.selector.description")}
            </Text>
          </VStack>
          {festivals.map((festival) => {
            const isSelected = festival.id === currentFestival?.id;
            const status = getFestivalStatus(festival);
            const { badgeClass, textClass } = getStatusBadgeStyles(status);

            return (
              <ActionsheetItem
                key={festival.id}
                onPress={() => handleFestivalSelect(festival)}
                className={isSelected ? "bg-primary-50" : ""}
              >
                <HStack className="w-full items-center justify-between">
                  <VStack space="xs" className="flex-1">
                    <HStack space="sm" className="items-center">
                      <ActionsheetItemText
                        className={
                          isSelected ? "font-semibold text-primary-600" : ""
                        }
                      >
                        {festival.name}
                      </ActionsheetItemText>
                      <Badge size="sm" className={cn("rounded-md", badgeClass)}>
                        <BadgeText className={cn("capitalize", textClass)}>
                          {status}
                        </BadgeText>
                      </Badge>
                    </HStack>
                    <Text className="text-xs text-typography-400">
                      {format(parseISO(festival.startDate), "MMM d")} -{" "}
                      {format(parseISO(festival.endDate), "MMM d, yyyy")}
                    </Text>
                    {festival.location && (
                      <Text className="text-xs text-typography-400">
                        {festival.location}
                      </Text>
                    )}
                  </VStack>
                  {isSelected && (
                    <Check size={20} color={Colors.primary[500]} />
                  )}
                </HStack>
              </ActionsheetItem>
            );
          })}
        </ActionsheetContent>
      </Actionsheet>

      {/* Biometric Authentication (if available) */}
      {isBiometricAvailable && (
        <View className="flex-row items-center justify-between border-b border-outline-100 py-3">
          <View className="flex-row items-center gap-3">
            {biometricType === "facial" ? (
              <ScanFace size={24} color={IconColors.default} />
            ) : (
              <Fingerprint size={24} color={IconColors.default} />
            )}
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
            trackColor={{
              false: SwitchColors.trackOff,
              true: SwitchColors.trackOn,
            }}
            thumbColor={SwitchColors.thumb}
            accessibilityLabel={`${biometricLabel} ${isBiometricEnabled ? t("common.status.enabled") : t("common.status.disabled")}`}
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
          <Bell size={24} color={IconColors.default} />
          <View>
            <Text className="text-typography-900">
              {t("profile.notifications.title")}
            </Text>
            <Text className="text-sm text-typography-500">
              {t("profile.notifications.description")}
            </Text>
          </View>
        </View>
        <ChevronRight size={24} color={IconColors.muted} />
      </Pressable>

      {/* Photo Privacy - Navigate to settings page */}
      <Pressable
        className="flex-row items-center justify-between border-b border-outline-100 py-3"
        onPress={() => router.push("/settings/photo-privacy")}
        accessibilityRole="button"
        accessibilityLabel={t("profile.photoPrivacy.title")}
      >
        <View className="flex-row items-center gap-3">
          <ImageIcon size={24} color={IconColors.default} />
          <View>
            <Text className="text-typography-900">
              {t("profile.photoPrivacy.title")}
            </Text>
            <Text className="text-sm text-typography-500">
              {t("profile.photoPrivacy.shortDescription")}
            </Text>
          </View>
        </View>
        <ChevronRight size={24} color={IconColors.muted} />
      </Pressable>

      {/* Language Display - Only English available for now */}
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-row items-center gap-3">
          <Languages size={24} color={IconColors.default} />
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
