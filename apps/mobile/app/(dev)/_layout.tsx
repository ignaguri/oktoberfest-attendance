/**
 * Dev Screens Layout
 *
 * Layout for developer-only screens.
 * Only accessible in development mode.
 */

import { defaultScreenOptions } from "@/lib/navigation/header-config";
import { Stack } from "expo-router";

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
