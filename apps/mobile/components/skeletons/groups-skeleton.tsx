import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Groups screen
 *
 * Matches the layout of:
 * - Header with action buttons
 * - 3 group card items
 */
export function GroupsSkeleton() {
  return (
    <VStack space="md" className="p-4">
      {/* Header with action buttons */}
      <HStack className="items-center justify-between">
        <Skeleton variant="rounded" className="h-4 w-24" />
        <HStack space="sm">
          <Skeleton variant="rounded" className="h-9 w-20" />
          <Skeleton variant="rounded" className="h-9 w-20" />
        </HStack>
      </HStack>

      {/* Group cards */}
      <VStack space="sm">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="outline" size="md" className="bg-white">
            <HStack className="items-center justify-between">
              <VStack space="xs" className="flex-1">
                <Skeleton variant="rounded" className="h-5 w-40" />
                <HStack space="xs" className="items-center">
                  <Skeleton variant="circular" className="h-4 w-4" />
                  <Skeleton variant="rounded" className="h-3 w-24" />
                </HStack>
              </VStack>
              <Skeleton variant="rounded" className="h-5 w-5" />
            </HStack>
          </Card>
        ))}
      </VStack>
    </VStack>
  );
}

GroupsSkeleton.displayName = "GroupsSkeleton";
