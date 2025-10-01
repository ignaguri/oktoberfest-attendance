"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonNewsFeed } from "@/components/ui/skeleton-cards";
import { useFestival } from "@/contexts/FestivalContext";
import { useActivityFeedItems } from "@/hooks/useActivityFeed";
import { cn } from "@/lib/utils";
import { Loader2, RadioTower, RefreshCw } from "lucide-react";
import { useCallback } from "react";

import { ActivityItem } from "./ActivityItem";

const NewsFeedHeader = ({
  activitiesCount,
  onRefresh,
  isRefreshing,
  _isError = false,
  _isEmpty = false,
}: {
  activitiesCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  _isError?: boolean;
  _isEmpty?: boolean;
}) => (
  <CardHeader>
    <CardTitle className="text-lg font-bold text-center flex items-center justify-center gap-2">
      <RadioTower className="size-5" />
      Latest activities
      {activitiesCount !== undefined && (
        <span className="text-sm font-normal text-muted-foreground">
          ({activitiesCount})
        </span>
      )}
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="size-8"
          title="Refresh activity feed"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      )}
    </CardTitle>
  </CardHeader>
);

const NewsFeed = () => {
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    activities,
    loading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
  } = useActivityFeedItems(currentFestival?.id);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    await refresh();
  }, [isRefreshing, refresh]);

  if (loading || festivalLoading) {
    return <SkeletonNewsFeed />;
  }

  if (error) {
    return (
      <Card className="w-full">
        <NewsFeedHeader
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          _isError={true}
        />
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Failed to load activity feed. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="w-full">
        <NewsFeedHeader
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          _isEmpty={true}
        />
        <CardContent>
          <div className="text-center py-8">
            <RadioTower className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No recent activity from your group members.
              <br />
              Activities will appear here when group members check into tents,
              drink beers, or upload photos!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <NewsFeedHeader
        activitiesCount={activities.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      <CardContent>
        <div className="flex flex-col gap-4">
          {activities.map((activity: any, index: number) => (
            <ActivityItem
              key={`${activity.user_id}-${activity.activity_time}-${index}`}
              activity={activity}
            />
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isFetchingNextPage}
                className="w-full"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading more...
                  </>
                ) : (
                  "Load more activities"
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsFeed;
export { NewsFeedHeader };
