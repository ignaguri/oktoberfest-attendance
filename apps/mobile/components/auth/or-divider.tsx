import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useTranslation } from 'react-i18next';

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
  const displayText = text ?? t('auth.signIn.orContinueWith', { defaultValue: 'or' });

  return (
    <View className="flex-row items-center w-full my-6">
      <View className="flex-1 h-px bg-background-300" />
      <Text className="text-typography-500 text-sm mx-4">{displayText}</Text>
      <View className="flex-1 h-px bg-background-300" />
    </View>
  );
}
