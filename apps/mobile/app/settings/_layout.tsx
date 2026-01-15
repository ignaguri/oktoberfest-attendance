import { defaultScreenOptions } from "@/lib/navigation/header-config";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

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
          title: t("profile.photoPrivacy.title"),
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
