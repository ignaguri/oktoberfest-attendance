import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Leaderboard screen
 *
 * Matches the layout of:
 * - Achievements link card
 * - Section header
 * - 6 leaderboard rows
 */
export function LeaderboardSkeleton() {
  return (
    <VStack space="md" className="p-4 pb-8">
      {/* Achievements Link Skeleton */}
      <Card
        variant="filled"
        size="md"
        className="border border-primary-200 bg-primary-100 px-4 py-4"
      >
        <HStack className="items-center justify-between">
          <HStack space="md" className="flex-1 items-center">
            <Skeleton variant="circular" className="h-10 w-10" />
            <VStack className="flex-1" space="xs">
              <Skeleton variant="rounded" className="h-4 w-36" />
              <Skeleton variant="rounded" className="h-3 w-28" />
            </VStack>
          </HStack>
          <Skeleton variant="rounded" className="h-6 w-6" />
        </HStack>
      </Card>

      {/* Divider */}
      <View className="my-1 h-px bg-outline-200" />

      {/* Section Header */}
      <HStack space="sm" className="items-center">
        <Skeleton variant="circular" className="h-6 w-6" />
        <Skeleton variant="rounded" className="h-6 w-48" />
      </HStack>

      {/* Leaderboard Table Skeleton */}
      <Card variant="outline" size="md" className="bg-white">
        <VStack>
          {/* Table Header */}
          <HStack className="items-center border-b border-outline-100 p-3">
            <Skeleton variant="rounded" className="mr-3 h-4 w-8" />
            <Skeleton variant="rounded" className="h-4 w-20" />
            <View className="flex-1" />
            <HStack space="md">
              <Skeleton variant="rounded" className="h-4 w-10" />
              <Skeleton variant="rounded" className="h-4 w-10" />
              <Skeleton variant="rounded" className="h-4 w-10" />
            </HStack>
          </HStack>

          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <HStack
              key={i}
              className="items-center border-b border-outline-50 p-3"
            >
              <Skeleton variant="rounded" className="mr-3 h-5 w-6" />
              <Skeleton variant="circular" className="mr-2 h-8 w-8" />
              <Skeleton variant="rounded" className="h-4 w-24" />
              <View className="flex-1" />
              <HStack space="md">
                <Skeleton variant="rounded" className="h-4 w-8" />
                <Skeleton variant="rounded" className="h-4 w-8" />
                <Skeleton variant="rounded" className="h-4 w-8" />
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Card>
    </VStack>
  );
}

LeaderboardSkeleton.displayName = "LeaderboardSkeleton";
