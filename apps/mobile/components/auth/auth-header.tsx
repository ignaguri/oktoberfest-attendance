import { useTranslation } from "@prostcounter/shared/i18n";
import React from "react";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";

interface AuthHeaderProps {
  /** Size variant of the header */
  size?: "sm" | "lg";
  /** Optional tagline to display below the app name */
  tagline?: string;
}

/**
 * Auth Header Component
 *
 * Displays the ProstCounter logo, branded app name, and optional tagline.
 * Used at the top of authentication screens.
 */
export function AuthHeader({ size = "lg", tagline }: AuthHeaderProps) {
  const { t } = useTranslation();
  const isLarge = size === "lg";

  return (
    <View className="items-center">
      {/* Logo */}
      <Image
        source={require("@/assets/images/logo.png")}
        className={isLarge ? "h-24 w-24" : "h-16 w-16"}
        resizeMode="contain"
        accessibilityLabel={t("app.logo")}
      />

      {/* App Name with gradient-like styling */}
      <View className="mt-3 flex-row">
        <Text
          className={`font-bold text-primary-600 ${isLarge ? "text-3xl" : "text-2xl"}`}
        >
          {t("app.namePart1")}
        </Text>
        <Text
          className={`font-bold text-primary-500 ${isLarge ? "text-3xl" : "text-2xl"}`}
        >
          {t("app.namePart2")}
        </Text>
      </View>

      {/* Optional Tagline */}
      {tagline && (
        <Text className="mt-2 text-center text-typography-500" size="sm">
          {tagline}
        </Text>
      )}
    </View>
  );
}
