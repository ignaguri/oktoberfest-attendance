import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function WrappedLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="archive"
        options={{
          ...defaultScreenOptions,
          headerShown: true,
          title: t("profile.wrappedArchive.title"),
        }}
      />
      <Stack.Screen
        name="personas"
        options={{
          ...defaultScreenOptions,
          headerShown: true,
          title: t("wrapped.personas.title"),
        }}
      />
    </Stack>
  );
}
