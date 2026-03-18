import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function FriendsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="search"
        options={{
          title: t("friends.search.placeholder"),
        }}
      />
    </Stack>
  );
}
