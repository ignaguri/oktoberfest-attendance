import { useAdminFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight } from "lucide-react-native";
import { RefreshControl } from "react-native";

import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export default function AdminFestivalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { festivals, isLoading, error, refetch, isRefetching } = useAdminFestivals();

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      contentContainerClassName="p-4"
      refreshControl={<RefreshControl refreshing={isRefetching ?? false} onRefresh={refetch} />}
    >
      <VStack space="md">
        {isLoading && (
          <Text className="text-typography-500">{t("admin.mobile.festivals.loading")}</Text>
        )}

        {!isLoading && festivals.length === 0 && (
          <Card size="md" variant="elevated">
            <VStack space="xs" className="items-center py-6">
              <CalendarDays size={32} color={IconColors.muted} />
              <Text className="text-typography-500">{t("admin.mobile.festivals.empty")}</Text>
            </VStack>
          </Card>
        )}

        {festivals.map((festival) => (
          <Pressable
            key={festival.id}
            onPress={() => router.push(`/admin/festival/${festival.id}`)}
            accessibilityRole="button"
            accessibilityLabel={festival.name}
            accessibilityHint={t("admin.mobile.festivals.openHint")}
          >
            <Card size="md" variant="elevated">
              <HStack className="items-center justify-between">
                <VStack space="xs" className="flex-1">
                  <HStack space="sm" className="items-center">
                    <Text className="font-semibold text-typography-900">{festival.name}</Text>
                    {festival.is_active && (
                      <Badge action="success" size="sm">
                        <BadgeText>{t("admin.mobile.festivals.activeBadge")}</BadgeText>
                      </Badge>
                    )}
                  </HStack>
                  <Text className="text-sm text-typography-500">
                    {festival.start_date} – {festival.end_date}
                  </Text>
                  <Text className="text-sm text-typography-400">
                    {t(`admin.mobile.festivals.status.${festival.status}`)} · {festival.location}
                  </Text>
                </VStack>
                <ChevronRight size={20} color={IconColors.muted} />
              </HStack>
            </Card>
          </Pressable>
        ))}

        <View className="h-4" />
      </VStack>
    </ScrollView>
  );
}
