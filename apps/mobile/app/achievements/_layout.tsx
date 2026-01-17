import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function AchievementsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t("achievements.pageTitle"),
        }}
      />
    </Stack>
  );
}
