import { useTranslation } from "@prostcounter/shared/i18n";
import { Tabs } from "expo-router";
import {
  CalendarDays,
  Home,
  Puzzle,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react-native";

import { Colors } from "@/lib/constants/colors";

interface TabIconProps {
  Icon: LucideIcon;
  color: string;
  focused: boolean;
}

function TabIcon({ Icon, color, focused }: TabIconProps) {
  return <Icon size={focused ? 28 : 24} color={color} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
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
          title: t("common.menu.leaderboard"),
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
  );
}
