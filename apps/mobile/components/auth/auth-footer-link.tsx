import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";

interface AuthFooterLinkProps {
  /** Prefix text displayed before the link */
  prefix: string;
  /** The clickable link text */
  linkText: string;
  /** Navigation destination */
  href: Href;
}

/**
 * Auth Footer Link Component
 *
 * Displays a prefix text followed by a clickable link.
 * Used for navigation between auth screens (e.g., "Don't have an account? Sign Up").
 */
export function AuthFooterLink({
  prefix,
  linkText,
  href,
}: AuthFooterLinkProps) {
  const router = useRouter();

  return (
    <View className="mt-4 flex-row items-center justify-center">
      <Text className="text-typography-600">{prefix} </Text>
      <Pressable onPress={() => router.push(href)}>
        <Text className="font-semibold text-primary-600">{linkText}</Text>
      </Pressable>
    </View>
  );
}
