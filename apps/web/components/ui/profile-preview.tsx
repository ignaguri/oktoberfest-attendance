"use client";

import {
  useAcceptFriendRequest,
  useFriendshipStatus,
  usePublicProfile,
  useSendFriendRequest,
} from "@prostcounter/shared/hooks";
import {
  Beer,
  Calendar,
  Check,
  Clock,
  Loader2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import { cn, getAvatarUrl } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Card, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";

interface ProfilePreviewProps {
  /** User ID for fetching profile with stats */
  userId?: string;
  /** Festival ID for fetching festival-specific stats */
  festivalId?: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function ProfilePreview({
  userId,
  festivalId,
  username,
  fullName,
  avatarUrl,
  children,
  className = "",
}: ProfilePreviewProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Only fetch profile data when dialog is open and we have a userId
  const { data: profile, loading } = usePublicProfile(
    isOpen ? userId : undefined,
    festivalId,
  );

  // Use fetched data if available, fallback to props
  const displayUsername = profile?.username ?? username;
  const displayFullName = profile?.fullName ?? fullName;
  const displayAvatarUrl = profile?.avatarUrl ?? avatarUrl;

  // Show username if available, otherwise full name
  const displayName = displayUsername || displayFullName || "Unknown";
  const fallbackInitial = displayName.charAt(0).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          className={cn(
            "cursor-pointer transition-colors hover:text-yellow-600",
            className,
          )}
        >
          {children}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-4 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                <p className="text-sm text-gray-500">
                  {t("common.status.loading")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={getAvatarUrl(displayAvatarUrl)}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-yellow-100 text-2xl text-yellow-800">
                    {fallbackInitial}
                  </AvatarFallback>
                </Avatar>
                <div>
                  {displayUsername && (
                    <CardTitle className="text-lg font-semibold">
                      {displayUsername}
                    </CardTitle>
                  )}
                  {displayFullName && (
                    <p
                      className={cn(
                        "text-gray-600",
                        displayUsername
                          ? "text-sm"
                          : "text-lg font-semibold text-gray-900",
                      )}
                    >
                      {displayFullName}
                    </p>
                  )}
                  {!displayUsername && !displayFullName && (
                    <CardTitle className="text-lg font-semibold">
                      Unknown User
                    </CardTitle>
                  )}
                </div>

                {/* Friendship badge / action button */}
                {profile?.friendshipStatus &&
                  profile.friendshipStatus !== "self" && (
                    <FriendshipBadge
                      status={profile.friendshipStatus}
                      userId={userId}
                    />
                  )}

                {/* Stats - only shown if we have stats from the API */}
                {profile?.stats && (
                  <div className="mt-2 flex gap-6">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-xl font-bold text-gray-900">
                          {profile.stats.daysAttended}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {t("leaderboard.stats.days")}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <Beer className="h-4 w-4 text-gray-400" />
                        <span className="text-xl font-bold text-gray-900">
                          {profile.stats.totalBeers}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {t("leaderboard.stats.drinks")}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-xl font-bold text-gray-900">
                          {profile.stats.avgBeers.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {t("leaderboard.stats.avg")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Shared groups - only shown when > 0 and not self */}
                {profile?.sharedGroups != null &&
                  profile.sharedGroups > 0 &&
                  profile.friendshipStatus !== "self" && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {profile.sharedGroups} {t("friends.sharedGroups")}
                      </span>
                    </div>
                  )}
              </div>
            )}
          </CardHeader>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

function FriendshipBadge({
  status,
  userId,
}: {
  status: "friends" | "pending_sent" | "pending_received" | "none";
  userId?: string;
}) {
  const { t } = useTranslation();
  const sendRequest = useSendFriendRequest();
  const { data: statusData } = useFriendshipStatus(
    status === "pending_received" ? userId : undefined,
  );
  const acceptRequest = useAcceptFriendRequest();

  const friendshipId = statusData?.friendshipId;

  const handleSendRequest = useCallback(async () => {
    if (!userId) return;
    try {
      await sendRequest.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  }, [sendRequest, userId]);

  const handleAcceptRequest = useCallback(async () => {
    if (!friendshipId) return;
    try {
      await acceptRequest.mutateAsync(friendshipId);
    } catch {
      // Error handled by mutation
    }
  }, [acceptRequest, friendshipId]);

  switch (status) {
    case "friends":
      return (
        <Badge
          variant="outline"
          className="border-green-300 bg-green-50 text-green-700"
        >
          <Check className="mr-1 h-3 w-3" />
          {t("friends.profileBadge.friends")}
        </Badge>
      );

    case "pending_sent":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" />
          {t("friends.profileBadge.requestSent")}
        </Badge>
      );

    case "pending_received":
      return (
        <Button
          variant="yellow"
          size="sm"
          onClick={handleAcceptRequest}
          disabled={acceptRequest.loading || !friendshipId}
        >
          {acceptRequest.loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Check className="mr-1 h-3 w-3" />
          )}
          {t("friends.profileBadge.acceptRequest")}
        </Button>
      );

    case "none":
      return (
        <Button
          variant="yellow"
          size="sm"
          onClick={handleSendRequest}
          disabled={sendRequest.loading}
        >
          {sendRequest.loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <UserPlus className="mr-1 h-3 w-3" />
          )}
          {t("friends.profileBadge.addFriend")}
        </Button>
      );
  }
}
