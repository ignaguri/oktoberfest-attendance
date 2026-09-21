import { useAdminGroups } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { ChevronRight, UsersRound } from "lucide-react-native";
import { RefreshControl } from "react-native";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export default function AdminGroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { groups, isLoading, error, refetch, isRefetching } = useAdminGroups();

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
          <Text className="text-typography-500">{t("admin.mobile.groups.loading")}</Text>
        )}

        {!isLoading && groups.length === 0 && (
          <Card size="md" variant="elevated">
            <VStack space="xs" className="items-center py-6">
              <UsersRound size={32} color={IconColors.muted} />
              <Text className="text-typography-500">{t("admin.mobile.groups.empty")}</Text>
            </VStack>
          </Card>
        )}

        {groups.map((group) => (
          <Pressable
            key={group.id}
            onPress={() => router.push(`/admin/group/${group.id}`)}
            accessibilityRole="button"
            accessibilityLabel={group.name}
            accessibilityHint={t("admin.mobile.groups.openHint")}
          >
            <Card size="md" variant="elevated">
              <HStack className="items-center justify-between">
                <VStack space="xs" className="flex-1">
                  <Text className="font-semibold text-typography-900">{group.name}</Text>
                  {group.description && (
                    <Text className="text-sm text-typography-500" numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <Text className="text-sm text-typography-400">
                    {t("admin.mobile.groups.memberCount", { count: group.member_count })}
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
