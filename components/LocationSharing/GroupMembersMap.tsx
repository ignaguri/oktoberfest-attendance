"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { useNearbyGroupMembers } from "@/hooks/useLocationSharing";
import { DEFAULT_AVATAR_URL } from "@/lib/constants";
import { MapPin, Users, Loader2 } from "lucide-react";
import { useMemo } from "react";

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

const formatLastUpdated = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
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
            Nearby Group Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Finding nearby members...</span>
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
            Nearby Group Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Failed to load nearby members. Please try again.
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
            Nearby Group Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {activeSharing
                ? "No group members are sharing their location nearby."
                : "Enable location sharing to see nearby group members."}
              <br />
              Members within {formatDistance(radiusMeters)} will appear here.
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
          Nearby Group Members
          <span className="text-sm font-normal text-muted-foreground ml-1">
            ({sortedMembers.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedMembers.map((member) => {
            const displayName =
              member.full_name || member.username || "Unknown User";
            const avatarSrc = member.avatar_url || DEFAULT_AVATAR_URL;

            return (
              <div
                key={member.user_id}
                className="flex items-center space-x-3 py-3 border-b border-border/50 last:border-b-0"
              >
                {/* User Avatar */}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="bg-yellow-100 text-yellow-700">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {displayName}
                    </span>
                    <span className="text-xs text-green-600 font-medium">
                      {formatDistance(member.distance_meters)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-wrap gap-1">
                      {member.group_names.map((groupName: string) => (
                        <span
                          key={groupName}
                          className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"
                        >
                          {groupName}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatLastUpdated(member.last_updated)}
                    </span>
                  </div>
                </div>

                {/* Location Indicator */}
                <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
              </div>
            );
          })}

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Showing members within {formatDistance(radiusMeters)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
