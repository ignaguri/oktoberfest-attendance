import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Achievements screen
 *
 * Matches the layout of:
 * - Stats summary card (unlocked/total, percentage, points)
 * - Section header
 * - 4 achievement cards
 */
export function AchievementsSkeleton() {
  return (
    <VStack space="lg" className="p-4 pb-8">
      {/* Stats Summary Skeleton */}
      <Card variant="outline" size="md" className="bg-white">
        <HStack className="items-center justify-around p-4">
          {[1, 2, 3].map((i) => (
            <VStack key={i} className="items-center" space="xs">
              <Skeleton variant="circular" className="h-12 w-12" />
              <Skeleton variant="rounded" className="h-6 w-12" />
              <Skeleton variant="rounded" className="h-3 w-16" />
            </VStack>
          ))}
        </HStack>
      </Card>

      {/* Section Header */}
      <VStack space="sm">
        <Skeleton variant="rounded" className="h-5 w-32" />

        {/* Achievement Cards */}
        <VStack space="sm">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="outline" size="sm" className="bg-white">
              <VStack space="sm" className="p-3">
                {/* Header: Icon + Name/Description + Rarity */}
                <HStack space="sm" className="items-start">
                  {/* Icon */}
                  <Skeleton variant="rounded" className="h-12 w-12" />

                  {/* Name and Description */}
                  <VStack className="flex-1" space="xs">
                    <Skeleton variant="rounded" className="h-4 w-32" />
                    <Skeleton variant="rounded" className="h-3 w-full" />
                  </VStack>

                  {/* Rarity Badge */}
                  <Skeleton variant="rounded" className="h-6 w-14" />
                </HStack>

                {/* Footer */}
                <HStack className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    <Skeleton variant="rounded" className="h-5 w-16" />
                    <Skeleton variant="rounded" className="h-4 w-12" />
                  </HStack>

                  {/* Progress */}
                  <VStack className="w-24" space="xs">
                    <View className="h-2 w-full rounded-full bg-background-200" />
                    <Skeleton
                      variant="rounded"
                      className="h-3 w-8 self-center"
                    />
                  </VStack>
                </HStack>
              </VStack>
            </Card>
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}

AchievementsSkeleton.displayName = "AchievementsSkeleton";
