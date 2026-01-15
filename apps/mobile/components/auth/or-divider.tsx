import { Text } from "@/components/ui/text";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

interface OrDividerProps {
  /** Custom text to display (defaults to translated "or") */
  text?: string;
}

/**
 * Or Divider Component
 *
 * A horizontal divider with centered "or" text.
 * Used to separate email/password forms from OAuth options.
 */
export function OrDivider({ text }: OrDividerProps) {
  const { t } = useTranslation();
  const displayText = text ?? t("auth.signIn.orContinueWith");

  return (
    <View className="my-6 w-full flex-row items-center">
      <View className="bg-background-300 h-px flex-1" />
      <Text className="text-typography-500 mx-4 text-sm">{displayText}</Text>
      <View className="bg-background-300 h-px flex-1" />
    </View>
  );
}
