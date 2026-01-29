"use client";

import { DEFAULT_AVATAR_URL } from "@prostcounter/shared/constants";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Loader2, MapPin, Users } from "lucide-react";
import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNearbyGroupMembers } from "@/hooks/useLocationSharing";

interface GroupMembersMapProps {
  className?: string;
  radiusMeters?: number;
}

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

const formatLastUpdated = (
  timestamp: string,
  t: (key: string) => string,
): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t("common.time.justNow");
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  } catch {
    return "Unknown";
  }
};

export const GroupMembersMap = ({
  className,
  radiusMeters = 500,
}: GroupMembersMapProps) => {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data, loading, error } = useNearbyGroupMembers(
    currentFestival?.id,
    radiusMeters,
  );

  const nearbyMembers = data?.nearbyMembers ?? [];
  const activeSharing = data?.activeSharing ?? false;

  const sortedMembers = useMemo(() => {
    if (!nearbyMembers) return [];
    return [...nearbyMembers].sort(
      (a, b) => a.distance_meters - b.distance_meters,
    );
  }, [nearbyMembers]);

  if (!currentFestival) {
    return null;
  }

  if (loading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("location.map.friendsNearby", {
              count: 0,
              defaultValue: "Nearby Group Members",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">
              {t("location.map.loading", {
                defaultValue: "Finding nearby members...",
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("location.map.friendsNearby", {
              count: 0,
              defaultValue: "Nearby Group Members",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {t("common.errors.generic", {
                defaultValue:
                  "Failed to load nearby members. Please try again.",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sortedMembers || sortedMembers.length === 0) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("location.map.friendsNearby", {
              count: 0,
              defaultValue: "Nearby Group Members",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              {activeSharing
                ? t("location.noFriendsNearby", {
                    defaultValue:
                      "No group members are sharing their location nearby.",
                  })
                : t("location.sharingInactive", {
                    defaultValue:
                      "Enable location sharing to see nearby group members.",
                  })}
              <br />
              {t("groups.join.passwordHelp", {
                defaultValue: "Members within {{radius}} will appear here.",
              }).replace("{{radius}}", formatDistance(radiusMeters))}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {t("location.map.friendsNearby", {
            count: sortedMembers.length,
            defaultValue: "Nearby Group Members",
          })}
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            ({sortedMembers.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedMembers.map((member) => {
            const displayName =
              member.full_name ||
              member.username ||
              t("activityFeed.unknownUser", { defaultValue: "Unknown User" });
            const avatarSrc = member.avatar_url || DEFAULT_AVATAR_URL;

            return (
              <div
                key={member.user_id}
                className="border-border/50 flex items-center space-x-3 border-b py-3 last:border-b-0"
              >
                {/* User Avatar */}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="bg-yellow-100 text-yellow-700">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Member Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <span className="text-xs font-medium text-green-600">
                      {formatDistance(member.distance_meters)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {member.group_names.map((groupName: string) => (
                        <span
                          key={groupName}
                          className="inline-block rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800"
                        >
                          {groupName}
                        </span>
                      ))}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatLastUpdated(member.last_updated, t)}
                    </span>
                  </div>
                </div>

                {/* Location Indicator */}
                <MapPin className="h-4 w-4 flex-shrink-0 text-green-500" />
              </div>
            );
          })}

          <div className="pt-2 text-center">
            <p className="text-muted-foreground text-xs">
              {t("groups.join.passwordHelp", {
                defaultValue: "Showing members within {{radius}}",
              }).replace("{{radius}}", formatDistance(radiusMeters))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
