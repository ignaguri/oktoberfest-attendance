import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  CalendarDays,
  ChevronRight,
  Database,
  MapPin,
  Tent,
  Users,
  UsersRound,
} from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/**
 * Admin sections available on mobile.
 *
 * Deliberately a list of pushed screens rather than the web panel's tab bar --
 * seven tabs do not survive phone width. Rows are added here as each section
 * lands; image conversion stays web-only (a server-side maintenance chore).
 */
const SECTIONS = [
  {
    key: "users" as const,
    href: "/admin/users" as const,
    Icon: Users,
  },
  {
    key: "groups" as const,
    href: "/admin/groups" as const,
    Icon: UsersRound,
  },
  {
    key: "festivals" as const,
    href: "/admin/festivals" as const,
    Icon: CalendarDays,
  },
  {
    key: "tents" as const,
    href: "/admin/tents" as const,
    Icon: Tent,
  },
  {
    key: "location" as const,
    href: "/admin/location" as const,
    Icon: MapPin,
  },
  {
    key: "cache" as const,
    href: "/admin/cache" as const,
    Icon: Database,
  },
] satisfies { key: string; href: string; Icon: LucideIcon }[];

export default function AdminHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <Text className="text-sm text-typography-500">{t("admin.mobile.hubDescription")}</Text>

        <Card size="md" variant="elevated">
          <VStack>
            {SECTIONS.map((section, index) => (
              <Pressable
                key={section.key}
                className={cn(
                  "flex-row items-center justify-between py-3",
                  index < SECTIONS.length - 1 && "border-b border-outline-100",
                )}
                onPress={() => router.push(section.href)}
                accessibilityRole="button"
                accessibilityLabel={t(`admin.tabs.${section.key}`)}
                accessibilityHint={t(`admin.mobile.sections.${section.key}`)}
              >
                <View className="flex-row items-center gap-3">
                  <section.Icon size={20} color={IconColors.default} />
                  <View className="flex-1">
                    <Text className="text-typography-900">{t(`admin.tabs.${section.key}`)}</Text>
                    <Text className="text-sm text-typography-500">
                      {t(`admin.mobile.sections.${section.key}`)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={IconColors.muted} />
              </Pressable>
            ))}
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}
