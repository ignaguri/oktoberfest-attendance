import { SERIES_CATEGORY_ORDER, splitCardsByCompletion } from "@prostcounter/shared/achievements";
import { useFestival } from "@prostcounter/shared/contexts";
import { useAchievementsWithProgress } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  SeriesCard as SeriesCardData,
  SeriesCategory,
  SeriesScope,
} from "@prostcounter/shared/schemas";
import { Award } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";

import { AchievementStatsSummary } from "@/components/achievements/achievement-stats-summary";
import { CategoryChips, type CategoryFilter } from "@/components/achievements/category-chips";
import { CloseToUnlockingRail } from "@/components/achievements/close-to-unlocking-rail";
import { ScopeToggle } from "@/components/achievements/scope-toggle";
import { SeriesCard } from "@/components/achievements/series-card";
import { AchievementsSkeleton } from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { OfflineScreen } from "@/components/ui/offline-screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useOfflineSafe } from "@/lib/database/offline-provider";

function CategorySection({
  category,
  cards,
}: {
  category: SeriesCategory;
  cards: SeriesCardData[];
}) {
  const { t } = useTranslation();
  const { completed, inProgress } = splitCardsByCompletion(cards);

  if (cards.length === 0) {
    return null;
  }

  return (
    <VStack space="sm">
      <Heading size="md" className="text-typography-900">
        {t(`achievements.categories.${category}`)}
      </Heading>

      {completed.length > 0 && (
        <VStack space="xs">
          <Text className="text-sm font-medium text-green-700">
            {t("achievements.completed")} ({completed.length})
          </Text>
          <VStack space="sm">
            {completed.map((card) => (
              <SeriesCard key={card.id} card={card} />
            ))}
          </VStack>
        </VStack>
      )}

      {inProgress.length > 0 && (
        <VStack space="xs">
          <Text className="text-sm font-medium text-typography-700">
            {t("achievements.inProgress")} ({inProgress.length})
          </Text>
          <VStack space="sm">
            {inProgress.map((card) => (
              <SeriesCard key={card.id} card={card} />
            ))}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}

/**
 * Achievements screen: stats summary, category chips, then one section per
 * category split into completed and in-progress cards.
 */
export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const { isOnline } = useOfflineSafe();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeScope, setActiveScope] = useState<SeriesScope>("festival");

  const {
    data: achievementsResponse,
    loading,
    error,
    refetch,
    isRefetching = false,
  } = useAchievementsWithProgress(currentFestival?.id);

  // Both scopes arrive in one response — the toggle is a filter, not a refetch.
  const cards = useMemo(() => {
    const allCards = achievementsResponse?.cards || [];
    return allCards.filter((card: SeriesCardData) => card.scope === activeScope);
  }, [achievementsResponse, activeScope]);

  const stats = useMemo(() => {
    return achievementsResponse?.stats || null;
  }, [achievementsResponse]);

  const visibleCategories = useMemo(() => {
    return activeCategory === "all"
      ? SERIES_CATEGORY_ORDER
      : [activeCategory as SeriesCategory];
  }, [activeCategory]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Offline state — achievements require server-side progress calculation
  if (!isOnline) {
    return <OfflineScreen messageKey="common.offline.achievementsUnavailable" />;
  }

  // Loading state (initial or festival loading)
  if (festivalLoading || (loading && cards.length === 0)) {
    return (
      <ScrollView className="flex-1 bg-background-50">
        <AchievementsSkeleton />
      </ScrollView>
    );
  }

  // No festival selected
  if (!currentFestival) {
    return (
      <ScrollView className="flex-1 bg-background-50">
        <VStack space="md" className="p-4">
          <Card variant="outline" size="md" className="items-center bg-white p-6">
            <Award size={48} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("achievements.noFestival")}
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    );
  }

  // Error state
  if (error && cards.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.primary[500]}
            colors={[Colors.primary[500]]}
          />
        }
      >
        <VStack space="md" className="p-4">
          <Card variant="outline" size="md" className="items-center bg-white p-6">
            <Award size={48} color={IconColors.error} />
            <Text className="mt-2 text-center text-error-600">{t("achievements.error")}</Text>
            <Text className="mt-1 text-center text-sm text-typography-400">
              {t("common.actions.pullToRefresh")}
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={Colors.primary[500]}
          colors={[Colors.primary[500]]}
        />
      }
    >
      <VStack space="lg" className="p-4 pb-8">
        {stats && <AchievementStatsSummary stats={stats} />}

        <ScopeToggle value={activeScope} onChange={setActiveScope} />

        <CategoryChips value={activeCategory} onChange={setActiveCategory} />

        {/* Scope-filtered but deliberately not category-filtered — the rail is
            a cross-category prompt. */}
        <CloseToUnlockingRail cards={cards} />

        {cards.length === 0 ? (
          <Card variant="outline" size="md" className="items-center bg-white p-6">
            <Award size={48} color={IconColors.muted} />
            <Text className="mt-2 text-center text-typography-500">{t("achievements.empty")}</Text>
          </Card>
        ) : (
          visibleCategories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              cards={cards.filter((card: SeriesCardData) => card.category === category)}
            />
          ))
        )}
      </VStack>
    </ScrollView>
  );
}
