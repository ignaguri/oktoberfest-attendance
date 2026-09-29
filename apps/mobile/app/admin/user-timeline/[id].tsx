import { useAdminUser } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams } from "expo-router";

import { UserTimeline } from "@/components/admin/analytics/user-timeline";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function AdminUserTimelineScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAdminUser(id);

  if (!id) {
    return <ErrorState message={t("admin.analytics.loadError")} showRetry={false} />;
  }

  return (
    <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
      <VStack space="md">
        <VStack>
          <Text className="text-lg font-semibold text-typography-900">
            {user?.profile?.full_name ?? user?.profile?.username ?? id}
          </Text>
          {user?.profile?.username && (
            <Text className="text-sm text-typography-500">@{user.profile.username}</Text>
          )}
        </VStack>
        <UserTimeline userId={id} />
      </VStack>
    </ScrollView>
  );
}
