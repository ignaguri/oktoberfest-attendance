import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Base skeleton card with consistent padding and minimum height
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "min-h-[120px] rounded-lg border border-gray-200 shadow-lg",
        className,
      )}
    >
      <CardHeader>
        <Skeleton className="mx-auto h-6 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for the highlights/stats section
 * Matches the 3-line stats layout from the screenshot
 */
export function SkeletonHighlights() {
  return (
    <Card className="min-h-[140px] rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold">
          <Skeleton className="mx-auto h-6 w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-blue-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for the leaderboard table
 * Matches the 3-row table layout from the screenshot
 */
export function SkeletonLeaderboard() {
  return (
    <Card className="min-h-[280px] rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold">
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-40" />
          </div>
        </CardTitle>
        <div className="text-center">
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="rounded-md border">
          <div className="p-2">
            {/* Table header */}
            <div className="mb-2 grid grid-cols-5 gap-2 border-b pb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-8" />
            </div>
            {/* Table rows */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 py-2">
                <Skeleton className="h-4 w-4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <Skeleton className="h-9 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for the achievements section
 * Matches the progress stats + 3 achievement buttons layout
 */
export function SkeletonAchievements() {
  return (
    <Card className="min-h-[200px] rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-center text-xl font-bold">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for the groups section
 * Matches the "no groups" message + button layout
 */
export function SkeletonGroups() {
  return (
    <div className="min-h-[120px]">
      <h2 className="mb-2 text-xl font-bold">
        <Skeleton className="h-6 w-32" />
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        <div className="px-2 text-center">
          <Skeleton className="mb-2 h-4 w-64" />
          <Skeleton className="mx-auto h-8 w-40" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the quick attendance form
 * Matches the tent selector + beer counter layout
 */
export function SkeletonQuickAttendance() {
  return (
    <div className="flex min-h-[120px] flex-col items-center gap-4">
      <Skeleton className="h-4 w-32" />
      <div className="flex w-full items-center justify-center gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-10 flex-shrink-0 rounded-sm" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the festival status alert
 * Matches the green alert with calendar icon layout
 */
export function SkeletonFestivalStatus() {
  return (
    <div className="w-fit">
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the news feed/activity feed
 * Matches the activity feed with avatar + content layout
 */
export function SkeletonNewsFeed() {
  return (
    <Card className="min-h-[320px] w-full rounded-lg border border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold">
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="border-border/50 flex items-start gap-3 border-b py-2 last:border-b-0"
            >
              {/* Avatar skeleton */}
              <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />

              {/* Content skeleton */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
