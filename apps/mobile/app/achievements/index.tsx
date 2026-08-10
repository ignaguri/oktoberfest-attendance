import { buildStats, SERIES_CATEGORY_ORDER, splitCardsByCompletion } from "@prostcounter/shared/achievements";
import { useFestival } from "@prostcounter/shared/contexts";
import { useAchievementsWithProgress } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  SeriesCard as SeriesCardData,
  SeriesCategory,
  SeriesScope,
  SeriesTier,
} from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { useLocalSearchParams } from "expo-router";
import { Award } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

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

/** How long the highlighted card keeps its ring after a toast-driven navigation. */
const HIGHLIGHT_DURATION_MS = 2000;

/** A rung's slug, recovered from the card it belongs to. One-offs have a single rung. */
function slugForCardTier(card: SeriesCardData, tier: SeriesTier): string {
  return card.tiers.length > 1 ? `${card.id}.t${tier.tier}` : card.id;
}

function cardMatchesHighlight(card: SeriesCardData, highlight: string): boolean {
  return (
    card.id === highlight || card.tiers.some((tier) => slugForCardTier(card, tier) === highlight)
  );
}

function CategorySection({
  category,
  cards,
  highlightedCardId,
  registerCardRef,
}: {
  category: SeriesCategory;
  cards: SeriesCardData[];
  highlightedCardId: string | null;
  registerCardRef: (cardId: string, node: View | null) => void;
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
              <View
                key={card.id}
                ref={(node) => registerCardRef(card.id, node)}
                className={cn(
                  "rounded-lg",
                  highlightedCardId === card.id && "ring-2 ring-yellow-500 ring-offset-2",
                )}
              >
                <SeriesCard card={card} />
              </View>
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
              <View
                key={card.id}
                ref={(node) => registerCardRef(card.id, node)}
                className={cn(
                  "rounded-lg",
                  highlightedCardId === card.id && "ring-2 ring-yellow-500 ring-offset-2",
                )}
              >
                <SeriesCard card={card} />
              </View>
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
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const cardRefs = useRef<Map<string, View>>(new Map());
  // Guards against re-triggering the scroll/highlight on every re-render while
  // the same `?highlight=` value is still in the route params.
  const processedHighlightRef = useRef<string | null>(null);

  const registerCardRef = useCallback((cardId: string, node: View | null) => {
    if (node) {
      cardRefs.current.set(cardId, node);
    } else {
      cardRefs.current.delete(cardId);
    }
  }, []);

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
    return achievementsResponse ? buildStats(cards) : null;
  }, [achievementsResponse, cards]);

  const visibleCategories = useMemo(() => {
    return activeCategory === "all"
      ? SERIES_CATEGORY_ORDER
      : [activeCategory as SeriesCategory];
  }, [activeCategory]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!highlight || !achievementsResponse || processedHighlightRef.current === highlight) {
      return;
    }

    const matchedCard = achievementsResponse.cards.find((card: SeriesCardData) =>
      cardMatchesHighlight(card, highlight),
    );
    if (!matchedCard) {
      return;
    }

    processedHighlightRef.current = highlight;
    setHighlightedCardId(matchedCard.id);

    const cardNode = cardRefs.current.get(matchedCard.id);
    // Measured against the ScrollView's inner content view, not the ScrollView
    // itself: measuring against the scroll responder is ambiguous about
    // whether the returned offset already accounts for the current scroll
    // position (iOS's UIScrollView.convertRect:toView: semantics subtract
    // it), which would land scrollTo() in the wrong place on a second
    // highlight while the screen is already scrolled. The inner content view
    // has no scroll offset of its own, so its coordinates are unambiguous.
    const relativeNode = scrollViewRef.current?.getInnerViewNode();
    if (cardNode && relativeNode) {
      cardNode.measureLayout(
        relativeNode,
        (_left, top) => {
          scrollViewRef.current?.scrollTo({ y: Math.max(top - 24, 0), animated: true });
        },
        () => {
          // No-op: the card may not be mounted yet (e.g. a collapsed section).
        },
      );
    }

    const timeoutId = setTimeout(() => setHighlightedCardId(null), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [highlight, achievementsResponse]);

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
      ref={scrollViewRef}
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
              highlightedCardId={highlightedCardId}
              registerCardRef={registerCardRef}
            />
          ))
        )}
      </VStack>
    </ScrollView>
  );
}
