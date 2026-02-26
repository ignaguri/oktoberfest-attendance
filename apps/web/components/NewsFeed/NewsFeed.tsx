"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import {
  type UnifiedFeedItem,
  useUnifiedFeed,
} from "@prostcounter/shared/hooks";
import { Loader2, RadioTower, RefreshCw } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonNewsFeed } from "@/components/ui/skeleton-cards";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { ActivityItem } from "./ActivityItem";
import { MessageItem } from "./MessageItem";

const NewsFeedHeader = ({
  itemCount,
  onRefresh,
  isRefreshing,
}: {
  itemCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <CardHeader>
      <CardTitle className="flex items-center justify-center gap-2 text-center text-lg font-bold">
        <RadioTower className="size-5" />
        {t("home.unifiedFeed.title")}
        {itemCount !== undefined && (
          <span className="text-muted-foreground text-sm font-normal">
            ({itemCount})
          </span>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="size-8"
            title={t("home.refreshFeed")}
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </Button>
        )}
      </CardTitle>
    </CardHeader>
  );
};

function FeedItemRenderer({
  item,
  festivalId,
}: {
  item: UnifiedFeedItem;
  festivalId?: string;
}) {
  switch (item.feedType) {
    case "activity":
      return <ActivityItem activity={item.data} />;
    case "message":
      return <MessageItem message={item.data} festivalId={festivalId} />;
    default:
      return null;
  }
}

const NewsFeed = () => {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const {
    feedItems,
    loading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
  } = useUnifiedFeed(currentFestival?.id);

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
        <NewsFeedHeader onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {t("home.unifiedFeed.error")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (feedItems.length === 0) {
    return (
      <Card className="w-full">
        <NewsFeedHeader onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        <CardContent>
          <div className="py-8 text-center">
            <RadioTower className="text-muted-foreground mx-auto mb-4 size-12" />
            <p className="text-muted-foreground text-sm">
              {t("home.unifiedFeed.empty")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <NewsFeedHeader
        itemCount={feedItems.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      <CardContent>
        <div className="flex flex-col gap-4">
          {feedItems.map((item) => (
            <FeedItemRenderer
              key={item.feedItemId}
              item={item}
              festivalId={currentFestival?.id}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.status.loading")}
                  </>
                ) : (
                  t("home.unifiedFeed.loadMore")
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
