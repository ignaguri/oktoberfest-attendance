import { Platform } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Home screen
 *
 * Matches the layout of:
 * - FestivalStatus card
 * - Location sharing card (native only)
 * - ActivityFeed with 3 items
 */
export function HomeSkeleton() {
  return (
    <VStack space="md">
      {/* Festival Status Skeleton */}
      <Card
        size="md"
        variant="filled"
        className="border border-outline-200 bg-background-100"
      >
        <HStack space="sm" className="items-center justify-center">
          <Skeleton variant="circular" className="h-7 w-7" />
          <Skeleton variant="rounded" className="h-5 w-40" />
          <Skeleton variant="rounded" className="h-5 w-24" />
        </HStack>
      </Card>

      {/* Location Sharing Card Skeleton (native only) */}
      {Platform.OS !== "web" && (
        <Card size="md" variant="elevated" className="p-3">
          <HStack className="items-center justify-between">
            <HStack space="sm" className="items-center">
              <Skeleton variant="circular" className="h-5 w-5" />
              <Skeleton variant="rounded" className="h-4 w-32" />
              <Skeleton variant="rounded" className="h-6 w-12" />
            </HStack>
            <Skeleton variant="rounded" className="h-9 w-20" />
          </HStack>
        </Card>
      )}

      {/* Activity Feed Skeleton */}
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          {/* Header */}
          <HStack className="items-center justify-between">
            <Skeleton variant="rounded" className="h-5 w-28" />
            <Skeleton variant="circular" className="h-5 w-5" />
          </HStack>

          {/* Activity Items */}
          <VStack space="sm" className="py-2">
            {[1, 2, 3].map((i) => (
              <HStack key={i} space="sm" className="items-center py-2">
                <Skeleton variant="circular" className="h-10 w-10" />
                <VStack className="flex-1" space="xs">
                  <Skeleton variant="rounded" className="h-4 w-32" />
                  <Skeleton variant="rounded" className="h-3 w-48" />
                </VStack>
              </HStack>
            ))}
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

HomeSkeleton.displayName = "HomeSkeleton";
