import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Attendance screen
 *
 * Matches the layout of:
 * - Calendar with header and day grid
 * - Stats summary section
 */
export function AttendanceSkeleton() {
  return (
    <View className="p-4">
      {/* Calendar Skeleton */}
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md" className="p-2">
          {/* Calendar Header */}
          <HStack className="items-center justify-between px-2">
            <Skeleton variant="circular" className="h-8 w-8" />
            <Skeleton variant="rounded" className="h-6 w-32" />
            <Skeleton variant="circular" className="h-8 w-8" />
          </HStack>

          {/* Day labels */}
          <HStack className="justify-around">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} variant="rounded" className="h-4 w-8" />
            ))}
          </HStack>

          {/* Calendar grid - 5 rows of 7 days */}
          {[1, 2, 3, 4, 5].map((row) => (
            <HStack key={row} className="justify-around py-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <Skeleton
                  key={`${row}-${day}`}
                  variant="circular"
                  className="h-10 w-10"
                />
              ))}
            </HStack>
          ))}
        </VStack>
      </Card>

      {/* Stats Summary Skeleton */}
      <Card variant="outline" size="md" className="mt-4 bg-white">
        <VStack space="md" className="p-4">
          {/* Title */}
          <Skeleton variant="rounded" className="h-4 w-24" />

          {/* Row 1: Days, Drinks, Avg */}
          <HStack className="justify-around">
            {[1, 2, 3].map((i) => (
              <VStack key={i} className="items-center" space="xs">
                <Skeleton variant="rounded" className="h-8 w-12" />
                <Skeleton variant="rounded" className="h-3 w-16" />
              </VStack>
            ))}
          </HStack>

          {/* Divider */}
          <View className="h-px bg-background-200" />

          {/* Row 2: Spending */}
          <HStack className="justify-around">
            {[1, 2, 3].map((i) => (
              <VStack key={i} className="items-center" space="xs">
                <Skeleton variant="rounded" className="h-8 w-12" />
                <Skeleton variant="rounded" className="h-3 w-16" />
              </VStack>
            ))}
          </HStack>
        </VStack>
      </Card>
    </View>
  );
}

AttendanceSkeleton.displayName = "AttendanceSkeleton";
