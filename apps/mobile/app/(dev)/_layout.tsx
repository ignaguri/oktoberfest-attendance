/**
 * Dev Screens Layout
 *
 * Layout for developer-only screens.
 * Only accessible in development mode.
 */

import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function DevLayout() {
  // Only show in development
  if (!__DEV__) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        ...defaultScreenOptions,
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="database-debug"
        options={{
          title: "Database Debug",
        }}
      />
    </Stack>
  );
}
