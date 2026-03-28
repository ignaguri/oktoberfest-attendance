import Ionicons from "@expo/vector-icons/Ionicons";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMemo } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CrowdReportFab } from "@/components/crowd/crowd-report-fab";
import {
  QuickAttendanceFab,
  QuickAttendanceSheet,
} from "@/components/quick-attendance";
import { VStack } from "@/components/ui/vstack";
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
  const { isOpen, closeSheet, preselectedTentId, preselectedTentName } =
    useQuickAttendance();

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

      {/* FAB group - positioned as a unit above the tab bar */}
      {showFab && <FabGroup isFestivalActive={isFestivalActive} />}

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
 * Vertically stacked FAB group positioned above the tab bar.
 * Crowd report FAB sits above the attendance FAB with a small gap.
 */
function FabGroup({ isFestivalActive }: { isFestivalActive: boolean }) {
  const insets = useSafeAreaInsets();
  const { openSheet, showCrowdFab, onCrowdFabPress } = useQuickAttendance();

  const nativeTabBarHeight = Platform.OS === "android" ? 100 : 50;
  const margin = insets.bottom === 0 ? 40 : 24;
  const bottomOffset = nativeTabBarHeight + margin + insets.bottom;

  return (
    <VStack
      space="sm"
      className="absolute right-4 items-end"
      style={{ bottom: bottomOffset }}
    >
      {showCrowdFab && onCrowdFabPress && (
        <CrowdReportFab onPress={onCrowdFabPress} />
      )}
      <QuickAttendanceFab
        onPress={() => openSheet()}
        disabled={!isFestivalActive}
        tutorialStepId="quick-attendance-fab"
      />
    </VStack>
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
