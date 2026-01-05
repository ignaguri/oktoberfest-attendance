"use client";

import { cn } from "@/lib/utils";

import type { AchievementWithProgress } from "@prostcounter/shared/schemas";

import { AchievementCard } from "./AchievementCard";

interface AchievementGridProps {
  achievements: AchievementWithProgress[];
  className?: string;
  showProgress?: boolean;
}

export function AchievementGrid({
  achievements,
  className,
  showProgress = true,
}: AchievementGridProps) {
  if (achievements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No achievements yet
        </h3>
        <p className="text-gray-600">
          Start attending festivals and recording beers to unlock achievements!
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {achievements.map((achievement) => (
        <AchievementCard
          key={achievement.id}
          achievement={achievement}
          showProgress={showProgress}
        />
      ))}
    </div>
  );
}
