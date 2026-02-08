import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";

import { defaultScreenOptions } from "@/lib/navigation/header-config";
import { QuickAttendanceProvider } from "@/lib/quick-attendance";

export default function MapLayout() {
  const { t } = useTranslation();

  return (
    <QuickAttendanceProvider>
      <Stack screenOptions={defaultScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: t("location.map.title"),
          }}
        />
      </Stack>
    </QuickAttendanceProvider>
  );
}
