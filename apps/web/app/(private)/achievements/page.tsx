"use client";

import {
  buildStats,
  SERIES_CATEGORY_ORDER,
  splitCardsByCompletion,
} from "@prostcounter/shared/achievements";
import { useFestival } from "@prostcounter/shared/contexts";
import type {
  SeriesCard as SeriesCardData,
  SeriesCategory,
  SeriesScope,
  SeriesTier,
} from "@prostcounter/shared/schemas";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CategoryChips, type CategoryFilter } from "@/components/achievements/CategoryChips";
import { CloseToUnlockingRail } from "@/components/achievements/CloseToUnlockingRail";
import { ScopeTabs } from "@/components/achievements/ScopeTabs";
import { SeriesCard } from "@/components/achievements/SeriesCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAchievementsWithProgress } from "@/hooks/useAchievements";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

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

function CardGrid({
  cards,
  highlightedCardId,
  registerCardRef,
}: {
  cards: SeriesCardData[];
  highlightedCardId: string | null;
  registerCardRef: (cardId: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          ref={(el) => registerCardRef(card.id, el)}
          className={cn(
            "rounded-lg transition-shadow duration-500",
            highlightedCardId === card.id && "ring-2 ring-yellow-500 ring-offset-2",
          )}
        >
          <SeriesCard card={card} />
        </div>
      ))}
    </div>
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
  registerCardRef: (cardId: string, el: HTMLDivElement | null) => void;
}) {
  const { t } = useTranslation();
  const { completed, inProgress } = splitCardsByCompletion(cards);

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{t(`achievements.categories.${category}`)}</h2>

      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-green-700">{t("achievements.completed")}</h3>
          <CardGrid
            cards={completed}
            highlightedCardId={highlightedCardId}
            registerCardRef={registerCardRef}
          />
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-700">{t("achievements.inProgress")}</h3>
          <CardGrid
            cards={inProgress}
            highlightedCardId={highlightedCardId}
            registerCardRef={registerCardRef}
          />
        </div>
      )}
    </section>
  );
}

export default function AchievementsPage() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data, loading: isLoading } = useAchievementsWithProgress(currentFestival?.id);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeScope, setActiveScope] = useState<SeriesScope>("festival");
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Guards against re-triggering the scroll/highlight on every re-render while
  // the same `?highlight=` value is still in the URL.
  const processedHighlightRef = useRef<string | null>(null);

  const registerCardRef = useCallback((cardId: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(cardId, el);
    } else {
      cardRefs.current.delete(cardId);
    }
  }, []);

  const allCards: SeriesCardData[] = data?.cards || [];
  // Both scopes arrive in one response — the tabs are a filter, not a refetch.
  const cards = allCards.filter((card) => card.scope === activeScope);
  const stats = data ? buildStats(cards) : undefined;

  const visibleCategories =
    activeCategory === "all" ? SERIES_CATEGORY_ORDER : [activeCategory as SeriesCategory];

  useEffect(() => {
    if (!highlight || !data || processedHighlightRef.current === highlight) {
      return;
    }

    const matchedCard: SeriesCardData | undefined = data.cards.find((card: SeriesCardData) =>
      cardMatchesHighlight(card, highlight),
    );
    if (!matchedCard) {
      return;
    }

    processedHighlightRef.current = highlight;
    setHighlightedCardId(matchedCard.id);
    cardRefs.current.get(matchedCard.id)?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeoutId = setTimeout(() => setHighlightedCardId(null), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [highlight, data]);

  if (!currentFestival) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">{t("achievements.pageTitle")}</h1>
          <p className="text-gray-600">{t("achievements.selectFestival")}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold">{t("achievements.pageTitle")}</h1>
          <p className="text-gray-600">{t("common.status.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">{t("achievements.pageTitle")}</h1>
        <p className="text-gray-600">
          {t("achievements.trackProgress", { festival: currentFestival.name })}
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.totalProgress")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">
                {stats.unlocked_achievements} / {stats.total_achievements}
              </div>
              <p className="text-sm text-gray-600">
                {t("achievements.stats.percentUnlocked", {
                  percent:
                    stats.total_achievements > 0
                      ? Math.round((stats.unlocked_achievements / stats.total_achievements) * 100)
                      : 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.totalPoints")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">{stats.total_points}</div>
              <p className="text-sm text-gray-600">{t("achievements.stats.achievementPoints")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.rarityBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {Object.entries(stats.breakdown_by_rarity).map(([rarity, rarityData]) => {
                  const breakdown = rarityData as { unlocked: number; total: number };
                  return (
                    <div key={rarity} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{t(`achievements.rarity.${rarity}`)}:</span>
                      <span className="font-medium">
                        {breakdown.unlocked}/{breakdown.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("achievements.stats.categories")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {Object.entries(stats.breakdown_by_category)
                  .filter(([_, categoryData]) => (categoryData as { total: number }).total > 0)
                  .slice(0, 3)
                  .map(([category, categoryData]) => {
                    const breakdown = categoryData as { unlocked: number; total: number };
                    return (
                      <div key={category} className="flex items-center justify-between text-sm">
                        <span className="capitalize">
                          {t(`achievements.categories.${category}`)}:
                        </span>
                        <span className="font-medium">
                          {breakdown.unlocked}/{breakdown.total}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ScopeTabs value={activeScope} onChange={setActiveScope} />

      <CategoryChips value={activeCategory} onChange={setActiveCategory} />

      {/* Scope-filtered but deliberately not category-filtered: the rail is a
          cross-category prompt, and narrowing it to one chip would routinely
          empty it. */}
      <CloseToUnlockingRail cards={cards} />

      {cards.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-4xl">🎯</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {t("achievements.empty.title")}
          </h3>
          <p className="text-gray-600">{t("achievements.empty.description")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleCategories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              cards={cards.filter((card: SeriesCardData) => card.category === category)}
              highlightedCardId={highlightedCardId}
              registerCardRef={registerCardRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}
