import Ionicons from "@expo/vector-icons/Ionicons";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMemo } from "react";
import { View } from "react-native";

import {
  QuickAttendanceFab,
  QuickAttendanceSheet,
} from "@/components/quick-attendance";
import { Colors } from "@/lib/constants/colors";
import {
  QuickAttendanceProvider,
  useQuickAttendance,
} from "@/lib/quick-attendance";

/**
 * Inner component that uses the quick attendance context
 */
function TabsLayoutContent() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const {
    isOpen,
    openSheet,
    closeSheet,
    preselectedTentId,
    preselectedTentName,
  } = useQuickAttendance();

  // Check if we're within festival dates
  const isFestivalActive = useMemo(() => {
    if (!currentFestival?.startDate || !currentFestival?.endDate) {
      return false;
    }
    const now = startOfDay(new Date());
    const start = startOfDay(parseISO(currentFestival.startDate));
    const end = startOfDay(parseISO(currentFestival.endDate));
    return !isBefore(now, start) && !isAfter(now, end);
  }, [currentFestival]);

  // Hide FAB if no festival is selected
  const showFab = !!currentFestival;

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={Colors.primary[500]}>
        {/* Home tab */}
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "house", selected: "house.fill" }}
            src={
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />
            }
          />
        </NativeTabs.Trigger>

        {/* Attendance tab */}
        <NativeTabs.Trigger name="attendance">
          <NativeTabs.Trigger.Label>
            {t("tabs.attendance")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "calendar", selected: "calendar" }}
            src={
              <NativeTabs.Trigger.VectorIcon
                family={Ionicons}
                name="calendar"
              />
            }
          />
        </NativeTabs.Trigger>

        {/* Groups tab */}
        <NativeTabs.Trigger name="groups">
          <NativeTabs.Trigger.Label>
            {t("tabs.groups")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "person.2", selected: "person.2.fill" }}
            src={
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="people" />
            }
          />
        </NativeTabs.Trigger>

        {/* Leaderboard tab */}
        <NativeTabs.Trigger name="leaderboard">
          <NativeTabs.Trigger.Label>
            {t("tabs.ranking")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "trophy", selected: "trophy.fill" }}
            src={
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="trophy" />
            }
          />
        </NativeTabs.Trigger>

        {/* Profile tab */}
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>
            {t("tabs.profile")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "person", selected: "person.fill" }}
            src={
              <NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />
            }
          />
        </NativeTabs.Trigger>

        {/* Components tab removed - Native tabs have 5-tab limit and overflow creates "More" menu */}
      </NativeTabs>

      {/* Quick Attendance FAB - self-registers with tutorial context */}
      {showFab && (
        <QuickAttendanceFab
          onPress={() => openSheet()}
          disabled={!isFestivalActive}
          tutorialStepId="quick-attendance-fab"
        />
      )}

      {/* Quick Attendance Sheet */}
      <QuickAttendanceSheet
        isOpen={isOpen}
        onClose={closeSheet}
        preselectedTentId={preselectedTentId}
        preselectedTentName={preselectedTentName}
      />
    </View>
  );
}

/**
 * Tabs layout with quick attendance provider
 * Uses Native Tabs for better performance and native appearance
 */
export default function TabsLayout() {
  return (
    <QuickAttendanceProvider>
      <TabsLayoutContent />
    </QuickAttendanceProvider>
  );
}
