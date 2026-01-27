import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { Tabs } from "expo-router";
import {
  CalendarDays,
  Home,
  type LucideIcon,
  Puzzle,
  Trophy,
  User,
  Users,
} from "lucide-react-native";
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

interface TabIconProps {
  Icon: LucideIcon;
  color: string;
  focused: boolean;
}

function TabIcon({ Icon, color, focused }: TabIconProps) {
  return <Icon size={focused ? 28 : 24} color={color} />;
}

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
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primary[500],
          },
          headerTintColor: Colors.black,
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerShadowVisible: true,
          tabBarActiveTintColor: Colors.primary[500],
          tabBarInactiveTintColor: Colors.gray[500],
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopColor: Colors.gray[200],
            paddingTop: 6,
            paddingBottom: 6,
            height: 52,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Home} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: t("common.menu.attendance"),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={CalendarDays} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: t("common.menu.groups"),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Users} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: t("leaderboard.screenTitle"),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={Trophy} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("common.menu.profile"),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon Icon={User} color={color} focused={focused} />
            ),
          }}
        />
        {/* Dev-only Components showcase tab */}
        {__DEV__ && (
          <Tabs.Screen
            name="components"
            options={{
              title: "Components",
              tabBarIcon: ({ color, focused }) => (
                <TabIcon Icon={Puzzle} color={color} focused={focused} />
              ),
            }}
          />
        )}
      </Tabs>

      {/* Quick Attendance FAB */}
      {showFab && (
        <QuickAttendanceFab
          onPress={() => openSheet()}
          disabled={!isFestivalActive}
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
 */
export default function TabsLayout() {
  return (
    <QuickAttendanceProvider>
      <TabsLayoutContent />
    </QuickAttendanceProvider>
  );
}
