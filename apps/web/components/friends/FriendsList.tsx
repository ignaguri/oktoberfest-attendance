"use client";

import { useFriends, useUnfriend } from "@prostcounter/shared/hooks";
import type { Friend } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { MoreHorizontal, Search, Users, UserX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n/client";

export function FriendsList() {
  const { t } = useTranslation();
  const { data: friends, loading } = useFriends();
  const unfriend = useUnfriend();

  const [filter, setFilter] = useState("");
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    if (!filter.trim()) return friends;
    const query = filter.toLowerCase();
    return friends.filter(
      (friend: Friend) =>
        friend.fullName?.toLowerCase().includes(query) ||
        friend.username?.toLowerCase().includes(query),
    );
  }, [friends, filter]);

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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder={t("friends.search.placeholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredFriends.length === 0 && !filter ? (
        <EmptyState
          icon={Users}
          title={t("friends.empty")}
          description={t("friends.search.noResults")}
        />
      ) : filteredFriends.length === 0 && filter ? (
        <EmptyState
          icon={Search}
          title={t("friends.search.noResults")}
          description={t("friends.search.noResults")}
        />
      ) : (
        <div className="space-y-2">
          {filteredFriends.map((friend: Friend) => (
            <Card key={friend.id}>
              <CardContent className="flex items-center gap-3 p-3">
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
      )}

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
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
