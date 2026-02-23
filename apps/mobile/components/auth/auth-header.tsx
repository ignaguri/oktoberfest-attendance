import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
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
          className={cn(
            "text-primary-600 font-bold",
            isLarge ? "text-3xl" : "text-2xl",
          )}
        >
          {t("app.namePart1")}
        </Text>
        <Text
          className={cn(
            "text-primary-500 font-bold",
            isLarge ? "text-3xl" : "text-2xl",
          )}
        >
          {t("app.namePart2")}
        </Text>
      </View>

      {/* Optional Tagline */}
      {tagline && (
        <Text className="text-typography-500 mt-2 text-center" size="sm">
          {tagline}
        </Text>
      )}
    </View>
  );
}
