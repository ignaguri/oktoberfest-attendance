"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useFriends, useUnfriend } from "@prostcounter/shared/hooks";
import type { Friend } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { MoreHorizontal, Users, UserX } from "lucide-react";
import { useCallback, useState } from "react";

import { AvatarPreview } from "@/components/Avatar/Avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfilePreview } from "@/components/ui/profile-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n/client";

export function FriendsList() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data: friends, loading } = useFriends();
  const unfriend = useUnfriend();

  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleUnfriend = useCallback(async () => {
    if (!unfriendTarget) return;
    try {
      await unfriend.mutateAsync(unfriendTarget.id);
    } catch {
      // Error handled by mutation
    }
    setUnfriendTarget(null);
  }, [unfriend, unfriendTarget]);

  if (loading) {
    return <FriendsListSkeleton />;
  }

  if (!friends || friends.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("friends.empty")}
        description={t("friends.search.noResults")}
      />
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {friends.map((friend: Friend) => (
          <Card key={friend.id} className="py-0">
            <CardContent className="flex items-center gap-3 px-3 py-2.5">
              <ProfilePreview
                userId={friend.id}
                festivalId={currentFestival?.id}
                username={friend.username}
                fullName={friend.fullName}
                avatarUrl={friend.avatarUrl}
              >
                <AvatarPreview
                  url={friend.avatarUrl}
                  previewUrl={null}
                  size="small"
                  fallback={{
                    username: friend.username,
                    full_name: friend.fullName,
                    email: friend.username || "user",
                  }}
                />
              </ProfilePreview>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {friend.fullName || friend.username}
                </p>
                {friend.username && friend.fullName && (
                  <p className="text-muted-foreground truncate text-sm">
                    @{friend.username}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {t("friends.friendsSince", {
                    date: formatLocalized(
                      new Date(friend.friendsSince),
                      "MMM d, yyyy",
                    ),
                  })}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      setUnfriendTarget({
                        id: friend.id,
                        name: friend.fullName || friend.username || "",
                      })
                    }
                  >
                    <UserX className="size-4" />
                    {t("friends.unfriend")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={unfriendTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnfriendTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("friends.unfriend")}</DialogTitle>
            <DialogDescription>
              {t("friends.unfriendConfirm", { name: unfriendTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.buttons.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleUnfriend}
              disabled={unfriend.loading}
            >
              {t("friends.unfriend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FriendsListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border px-3 py-2"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
