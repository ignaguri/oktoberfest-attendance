"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { AchievementProgress as AchievementProgressType } from "@prostcounter/shared/schemas";

interface AchievementProgressProps {
  progress: AchievementProgressType;
  className?: string;
  showLabel?: boolean;
}

export function AchievementProgress({
  progress,
  className,
  showLabel = true,
}: AchievementProgressProps) {
  const { current_value, target_value, percentage } = progress;

  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium text-gray-900">
            {current_value} / {target_value}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <Progress value={clampedPercentage} className="h-2" />

        <div className="text-xs text-gray-500 text-right">
          {Math.round(clampedPercentage)}% complete
        </div>
      </div>
    </div>
  );
}
