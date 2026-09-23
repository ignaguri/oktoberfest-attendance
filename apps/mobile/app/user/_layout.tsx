import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function UserLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="[id]"
        options={{
          title: t("profile.page.title"),
        }}
      />
    </Stack>
  );
}
