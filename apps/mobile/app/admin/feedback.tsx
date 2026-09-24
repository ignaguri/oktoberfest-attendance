import { useAdminFeedback } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { FEEDBACK_FACES, type FeedbackKind } from "@prostcounter/shared/schemas";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { MessageSquare } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

type FeedbackFilter = "all" | FeedbackKind;

export default function AdminFeedbackScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { items, isLoading, error, refetch } = useAdminFeedback(
    filter === "all" ? undefined : filter,
  );

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  if (error) {
    return <ErrorState message={t("admin.feedback.error")} onRetry={refetch} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      contentContainerClassName="p-4"
      refreshControl={
        <RefreshControl refreshing={isPullRefreshing} onRefresh={handlePullRefresh} />
      }
    >
      <VStack space="md">
        <SegmentedControl
          tabs={[
            { key: "all", label: t("admin.feedback.filters.all") },
            { key: "day", label: t("admin.feedback.filters.day") },
            { key: "bug", label: t("admin.feedback.filters.bug") },
            { key: "idea", label: t("admin.feedback.filters.idea") },
          ]}
          activeTab={filter}
          onTabChange={(key) => setFilter(key as FeedbackFilter)}
        />

        {isLoading && <Text className="text-typography-500">{t("admin.feedback.loading")}</Text>}

        {!isLoading && items.length === 0 && (
          <Card size="md" variant="elevated">
            <VStack space="xs" className="items-center py-6">
              <MessageSquare size={32} color={IconColors.muted} />
              <Text className="text-typography-500">{t("admin.feedback.empty")}</Text>
            </VStack>
          </Card>
        )}

        {items.map((item) => {
          const face = FEEDBACK_FACES.find((entry) => entry.rating === item.rating);
          return (
            <Card key={item.id} size="md" variant="elevated">
              <VStack space="sm">
                <HStack className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    {face && <Text className="text-2xl">{face.emoji}</Text>}
                    <Text className="font-semibold text-typography-900">
                      {t(`admin.feedback.kinds.${item.kind}`)}
                    </Text>
                  </HStack>
                  <Text className="text-xs text-typography-400">
                    {formatRelativeTime(new Date(item.createdAt))}
                  </Text>
                </HStack>
                <Text className="text-typography-800">
                  {item.message ?? t("admin.feedback.noMessage")}
                </Text>
                <Text className="text-xs text-typography-500">
                  {[
                    item.user.username ?? item.user.fullName ?? item.user.id,
                    item.festivalName,
                    item.day,
                    item.platform,
                    item.appVersion,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </VStack>
            </Card>
          );
        })}
      </VStack>
    </ScrollView>
  );
}
