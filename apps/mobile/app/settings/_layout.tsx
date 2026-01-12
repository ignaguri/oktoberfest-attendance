import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="notifications"
        options={{
          title: t("profile.notifications.title"),
        }}
      />
      <Stack.Screen
        name="photo-privacy"
        options={{
          title: t("profile.photoPrivacy.title", { defaultValue: "Photo Privacy" }),
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          title: t("profile.changePassword.title"),
        }}
      />
    </Stack>
  );
}
