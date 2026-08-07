"use client";

import type { AchievementTier } from "@prostcounter/shared/achievements";
import { tierToRarity } from "@prostcounter/shared/achievements";
import { useFestival } from "@prostcounter/shared/contexts";
import type { RecentUnlock } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonAchievements } from "@/components/ui/skeleton-cards";
import { useAchievementsWithProgress } from "@/hooks/useAchievements";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";

const RECENT_UNLOCK_COUNT = 3;

interface AchievementHighlightProps {
  className?: string;
}

export function AchievementHighlight({ className }: AchievementHighlightProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data, loading: isLoading } = useAchievementsWithProgress(currentFestival?.id);

  if (!currentFestival || isLoading) {
    return <SkeletonAchievements />;
  }

  const stats = data?.stats;

  if (!stats || stats.unlocked_achievements === 0) {
    return null; // Don't show if no achievements yet
  }

  // Already sorted newest-first by the API.
  const recentUnlocks = (data?.recentUnlocks || []).slice(0, RECENT_UNLOCK_COUNT);

  return (
    <Card className={cn("min-h-[200px] rounded-lg border border-gray-200 shadow-lg", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-center text-xl font-bold">
          🎖️ {t("achievements.pageTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("achievements.card.progress")}:</span>
            <span className="font-semibold">
              {stats.unlocked_achievements} / {stats.total_achievements}{" "}
              {t("achievements.unlocked").toLowerCase()}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("achievements.card.points")}:</span>
            <span className="font-semibold text-yellow-600">
              {stats.total_points} {t("achievements.points")}
            </span>
          </div>

          {recentUnlocks.length > 0 && (
            <div className="space-y-2">
              <CardDescription className="font-semibold">
                🎉 {t("achievements.highlight.recent")}:
              </CardDescription>
              <div className="space-y-2">
                {recentUnlocks.map((unlock: RecentUnlock) => (
                  <div key={unlock.id} className="flex flex-col items-center gap-2">
                    <AchievementBadge
                      name={unlock.name}
                      icon={unlock.glyph}
                      category={unlock.category}
                      tier={unlock.tier as AchievementTier}
                      rarity={tierToRarity(unlock.tier)}
                      points={unlock.points}
                      isUnlocked={true}
                      size="sm"
                      className="flex-1 truncate"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button asChild variant="outline" className="w-fit">
            <Link href="/achievements">{t("achievements.viewMyAchievements")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
