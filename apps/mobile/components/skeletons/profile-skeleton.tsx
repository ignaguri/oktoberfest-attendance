import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";

/**
 * Skeleton loader for the Profile screen
 *
 * Matches the layout of:
 * - Profile header (avatar + name + email + edit button)
 * - Settings section
 * - Action buttons
 */
export function ProfileSkeleton() {
  return (
    <VStack space="lg" className="p-4">
      {/* Profile Header Skeleton */}
      <Card size="lg" variant="elevated" className="items-center">
        <VStack space="md" className="items-center">
          {/* Avatar */}
          <Skeleton variant="circular" className="h-24 w-24" />

          {/* Name and email */}
          <VStack space="xs" className="items-center">
            <Skeleton variant="rounded" className="h-6 w-32" />
            <Skeleton variant="rounded" className="h-4 w-40" />
            <Skeleton variant="rounded" className="h-4 w-48" />
          </VStack>

          {/* Edit button */}
          <Skeleton variant="rounded" className="h-9 w-20" />
        </VStack>
      </Card>

      {/* Settings Section Skeleton */}
      <Card size="md" variant="outline" className="bg-white">
        <VStack space="md">
          {/* Section title */}
          <Skeleton variant="rounded" className="h-5 w-20" />

          {/* Toggle rows */}
          {[1, 2].map((i) => (
            <HStack key={i} className="items-center justify-between py-2">
              <HStack space="sm" className="items-center">
                <Skeleton variant="circular" className="h-5 w-5" />
                <Skeleton variant="rounded" className="h-4 w-32" />
              </HStack>
              <Skeleton variant="rounded" className="h-6 w-12" />
            </HStack>
          ))}
        </VStack>
      </Card>

      {/* Action Buttons Skeleton */}
      <Card size="md" variant="ghost">
        <VStack space="lg" className="items-center">
          <Skeleton variant="rounded" className="h-10 w-32" />
          <Skeleton variant="rounded" className="h-10 w-40" />
        </VStack>
      </Card>

      {/* Tutorial Section Skeleton */}
      <Card
        size="md"
        variant="outline"
        className="border-yellow-200 bg-yellow-50"
      >
        <VStack space="md" className="items-center">
          <Skeleton variant="rounded" className="h-5 w-24" />
          <Skeleton variant="rounded" className="h-4 w-48" />
          <Skeleton variant="rounded" className="h-9 w-32" />
        </VStack>
      </Card>

      {/* App Version Skeleton */}
      <Skeleton variant="rounded" className="mx-auto h-3 w-20" />
    </VStack>
  );
}

ProfileSkeleton.displayName = "ProfileSkeleton";
