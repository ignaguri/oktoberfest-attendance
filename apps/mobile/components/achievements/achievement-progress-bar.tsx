import type { AchievementProgress } from "@prostcounter/shared/schemas";

import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface AchievementProgressBarProps {
  progress: AchievementProgress;
  showLabel?: boolean;
}

/**
 * Progress bar for achievements showing current/target values
 */
export function AchievementProgressBar({
  progress,
  showLabel = true,
}: AchievementProgressBarProps) {
  const { current_value, target_value, percentage } = progress;

  return (
    <VStack space="xs">
      <Progress value={percentage} size="sm" className="w-full">
        <ProgressFilledTrack />
      </Progress>
      {showLabel && (
        <Text className="text-typography-500 text-xs">
          {current_value} / {target_value} ({Math.round(percentage)}%)
        </Text>
      )}
    </VStack>
  );
}

AchievementProgressBar.displayName = "AchievementProgressBar";
