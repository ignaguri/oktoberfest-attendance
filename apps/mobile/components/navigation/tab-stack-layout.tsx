import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

interface TabStackLayoutProps {
  titleKey: string;
  headerShown?: boolean;
}

/**
 * Reusable Stack layout for tab screens.
 * Provides consistent header styling across all tabs.
 */
export function TabStackLayout({
  titleKey,
  headerShown = true,
}: TabStackLayoutProps) {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        ...defaultScreenOptions,
        headerShown,
        headerLeft: () => null, // No back button on tab roots
      }}
    >
      <Stack.Screen name="index" options={{ title: t(titleKey) }} />
    </Stack>
  );
}
