"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import type { AchievementWithProgress } from "@prostcounter/shared/schemas";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkeletonAchievements } from "@/components/ui/skeleton-cards";
import { useAchievementsWithProgress } from "@/hooks/useAchievements";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";

interface AchievementHighlightProps {
  className?: string;
}

export function AchievementHighlight({ className }: AchievementHighlightProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data, loading: isLoading } = useAchievementsWithProgress(
    currentFestival?.id,
  );

  const achievements = data?.data || [];

  if (!currentFestival || isLoading) {
    return <SkeletonAchievements />;
  }

  const unlockedAchievements = achievements.filter(
    (a: AchievementWithProgress) => a.is_unlocked,
  );
  const recentAchievements = unlockedAchievements
    .sort(
      (a: AchievementWithProgress, b: AchievementWithProgress) =>
        new Date(b.unlocked_at || 0).getTime() -
        new Date(a.unlocked_at || 0).getTime(),
    )
    .slice(0, 3);

  const totalPoints = unlockedAchievements.reduce(
    (sum: number, a: AchievementWithProgress) => sum + a.points,
    0,
  );

  if (unlockedAchievements.length === 0) {
    return null; // Don't show if no achievements yet
  }

  return (
    <Card
      className={cn(
        "min-h-[200px] rounded-lg border border-gray-200 shadow-lg",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-center text-xl font-bold">
          🎖️ {t("achievements.pageTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {t("achievements.card.progress")}:
            </span>
            <span className="font-semibold">
              {unlockedAchievements.length} / {achievements.length}{" "}
              {t("achievements.unlocked").toLowerCase()}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {t("achievements.card.points")}:
            </span>
            <span className="font-semibold text-yellow-600">
              {totalPoints} {t("achievements.points")}
            </span>
          </div>

          {recentAchievements.length > 0 && (
            <div className="space-y-2">
              <CardDescription className="font-semibold">
                🎉 {t("achievements.highlight.recent")}:
              </CardDescription>
              <div className="space-y-2">
                {recentAchievements.map(
                  (achievement: AchievementWithProgress) => (
                    <div
                      key={achievement.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <AchievementBadge
                        name={t(achievement.name, {
                          defaultValue: achievement.name,
                        })}
                        icon={achievement.icon}
                        rarity={achievement.rarity}
                        points={achievement.points}
                        isUnlocked={true}
                        size="sm"
                        className="flex-1 truncate"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          <Button asChild variant="outline" className="w-fit">
            <Link href="/achievements">
              {t("achievements.viewMyAchievements")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
