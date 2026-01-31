import Ionicons from "@expo/vector-icons/Ionicons";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { useMemo } from "react";
import { View } from "react-native";

import {
  QuickAttendanceFab,
  QuickAttendanceSheet,
} from "@/components/quick-attendance";
import { TutorialTarget } from "@/components/tutorial";
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
        <NativeTabs.Trigger name="index">
          <Label>{t("tabs.home")}</Label>
          <Icon
            sf={{ default: "house", selected: "house.fill" }}
            androidSrc={<VectorIcon family={Ionicons} name="home" />}
          />
        </NativeTabs.Trigger>

        {/* Attendance tab */}
        <NativeTabs.Trigger name="attendance">
          <Label>{t("tabs.attendance")}</Label>
          <Icon
            sf={{ default: "calendar", selected: "calendar" }}
            androidSrc={<VectorIcon family={Ionicons} name="calendar" />}
          />
        </NativeTabs.Trigger>

        {/* Groups tab */}
        <NativeTabs.Trigger name="groups">
          <Label>{t("tabs.groups")}</Label>
          <Icon
            sf={{ default: "person.2", selected: "person.2.fill" }}
            androidSrc={<VectorIcon family={Ionicons} name="people" />}
          />
        </NativeTabs.Trigger>

        {/* Leaderboard tab */}
        <NativeTabs.Trigger name="leaderboard">
          <Label>{t("tabs.ranking")}</Label>
          <Icon
            sf={{ default: "trophy", selected: "trophy.fill" }}
            androidSrc={<VectorIcon family={Ionicons} name="trophy" />}
          />
        </NativeTabs.Trigger>

        {/* Profile tab */}
        <NativeTabs.Trigger name="profile">
          <Label>{t("tabs.profile")}</Label>
          <Icon
            sf={{ default: "person", selected: "person.fill" }}
            androidSrc={<VectorIcon family={Ionicons} name="person" />}
          />
        </NativeTabs.Trigger>

        {/* Components tab removed - Native tabs have 5-tab limit and overflow creates "More" menu */}
      </NativeTabs>

      {/* Quick Attendance FAB */}
      {showFab && (
        <TutorialTarget stepId="quick-attendance-fab">
          <QuickAttendanceFab
            onPress={() => openSheet()}
            disabled={!isFestivalActive}
          />
        </TutorialTarget>
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
