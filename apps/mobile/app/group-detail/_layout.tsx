import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function GroupsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="[id]/index"
        options={{
          title: t("groups.detail.title"),
        }}
      />
      <Stack.Screen
        name="[id]/settings"
        options={{
          title: t("groups.settings.title"),
        }}
      />
      <Stack.Screen
        name="[id]/messages"
        options={{
          title: t("groups.messages.title"),
        }}
      />
    </Stack>
  );
}
