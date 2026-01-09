import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

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
export function AuthFooterLink({ prefix, linkText, href }: AuthFooterLinkProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-center mt-4">
      <Text className="text-typography-600">{prefix} </Text>
      <Pressable onPress={() => router.push(href)}>
        <Text className="text-primary-600 font-semibold">{linkText}</Text>
      </Pressable>
    </View>
  );
}
