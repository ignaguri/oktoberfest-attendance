import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Attendance screen
 *
 * Mirrors the festival strip that loads into it: a centred date-range label,
 * weekday headers, and rounded 48pt cells. It previously drew a month grid with
 * prev/next arrows and circular cells, which the strip replaced - so the screen
 * resolved into a different shape than the one it had just promised.
 *
 * Three week rows: a 16-day festival spans three once weekday-aligned, and this
 * is the taller, better guess for the shorter ones.
 */
export function AttendanceSkeleton() {
  return (
    <View className="p-4">
      {/* Festival strip skeleton */}
      <Card variant="outline" size="md" className="bg-white">
        <VStack className="p-2">
          {/* Date range label */}
          <HStack className="mb-4 justify-center">
            <Skeleton variant="rounded" className="h-6 w-44" />
          </HStack>

          {/* Weekday headers */}
          <HStack className="mb-2 justify-around">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <View key={i} className="w-12 items-center">
                <Skeleton variant="rounded" className="h-3 w-8" />
              </View>
            ))}
          </HStack>

          <VStack space="xs">
            {[1, 2, 3].map((row) => (
              <HStack key={row} className="justify-around">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <Skeleton key={`${row}-${day}`} variant="rounded" className="h-12 w-12" />
                ))}
              </HStack>
            ))}
          </VStack>

          {/* Legend */}
          <HStack space="lg" className="mt-4 justify-center border-t border-background-200 pt-4">
            {[1, 2, 3].map((i) => (
              <HStack key={i} space="sm" className="items-center">
                <Skeleton variant="rounded" className="h-3 w-3" />
                <Skeleton variant="rounded" className="h-3 w-16" />
              </HStack>
            ))}
          </HStack>
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
