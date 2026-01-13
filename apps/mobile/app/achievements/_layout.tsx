import { defaultScreenOptions } from "@/lib/navigation/header-config";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AchievementsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: t("achievements.pageTitle", { defaultValue: "Achievements" }),
        }}
      />
    </Stack>
  );
}
