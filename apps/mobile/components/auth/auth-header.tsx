import React from 'react';
import { View, Image } from 'react-native';
import { Text } from '@/components/ui/text';

interface AuthHeaderProps {
  /** Size variant of the header */
  size?: 'sm' | 'lg';
  /** Optional tagline to display below the app name */
  tagline?: string;
}

/**
 * Auth Header Component
 *
 * Displays the ProstCounter logo, branded app name, and optional tagline.
 * Used at the top of authentication screens.
 */
export function AuthHeader({ size = 'lg', tagline }: AuthHeaderProps) {
  const isLarge = size === 'lg';

  return (
    <View className="items-center">
      {/* Logo */}
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('@/assets/images/logo.png')}
        className={isLarge ? 'h-24 w-24' : 'h-16 w-16'}
        resizeMode="contain"
      />

      {/* App Name with gradient-like styling */}
      <View className="flex-row mt-3">
        <Text
          className={`font-bold text-primary-600 ${isLarge ? 'text-3xl' : 'text-2xl'}`}
        >
          Prost
        </Text>
        <Text
          className={`font-bold text-primary-500 ${isLarge ? 'text-3xl' : 'text-2xl'}`}
        >
          Counter
        </Text>
      </View>

      {/* Optional Tagline */}
      {tagline && (
        <Text className="text-typography-500 text-center mt-2" size="sm">
          {tagline}
        </Text>
      )}
    </View>
  );
}
