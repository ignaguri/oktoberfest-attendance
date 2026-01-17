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
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";

interface AchievementHighlightProps {
  className?: string;
}

export function AchievementHighlight({ className }: AchievementHighlightProps) {
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
          🎖️ Achievements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress:</span>
            <span className="font-semibold">
              {unlockedAchievements.length} / {achievements.length} unlocked
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Points:</span>
            <span className="font-semibold text-yellow-600">
              {totalPoints} pts
            </span>
          </div>

          {recentAchievements.length > 0 && (
            <div className="space-y-2">
              <CardDescription className="font-semibold">
                🎉 Recent achievements:
              </CardDescription>
              <div className="space-y-2">
                {recentAchievements.map(
                  (achievement: AchievementWithProgress) => (
                    <div
                      key={achievement.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <AchievementBadge
                        name={achievement.name}
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
            <Link href="/achievements">View All Achievements</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
