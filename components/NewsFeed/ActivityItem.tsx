"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_AVATAR_URL } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { Beer, MapPin, Camera, Users, Trophy, Clock } from "lucide-react";
import { Link } from "next-view-transitions";
import { useMemo } from "react";

import type { ActivityFeedItem } from "@/hooks/useActivityFeed";

interface ActivityItemProps {
  activity: ActivityFeedItem;
}

const getActivityIcon = (type: ActivityFeedItem["activity_type"]) => {
  switch (type) {
    case "beer_count_update":
      return <Beer className="h-4 w-4" />;
    case "tent_checkin":
      return <MapPin className="h-4 w-4" />;
    case "photo_upload":
      return <Camera className="h-4 w-4" />;
    case "group_join":
      return <Users className="h-4 w-4" />;
    case "achievement_unlock":
      return <Trophy className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActivityDescription = (activity: ActivityFeedItem) => {
  const { activity_type, activity_data, username } = activity;

  switch (activity_type) {
    case "beer_count_update":
      const beerCount = activity_data.beer_count || 0;
      const date = activity_data.date;
      return `drank ${beerCount} beer${beerCount !== 1 ? "s" : ""} ${date ? `on ${new Date(date).toLocaleDateString()}` : ""}`;

    case "tent_checkin":
      const tentName = activity_data.tent_name || "a tent";
      return `checked into ${tentName}`;

    case "photo_upload":
      const photoDate = activity_data.date;
      return `uploaded a photo${photoDate ? ` from ${new Date(photoDate).toLocaleDateString()}` : ""}`;

    case "group_join":
      const groupName = activity_data.group_name || "a group";
      return `joined ${groupName}`;

    case "achievement_unlock":
      const achievementName =
        activity_data.achievement_name || "an achievement";
      const rarity = activity_data.rarity;
      return `unlocked ${achievementName}${rarity ? ` (${rarity})` : ""}`;

    default:
      return "had some activity";
  }
};

const getRarityColor = (rarity?: string) => {
  switch (rarity) {
    case "legendary":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "epic":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "rare":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "common":
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

export const ActivityItem = ({ activity }: ActivityItemProps) => {
  const {
    username,
    full_name,
    avatar_url,
    activity_time,
    activity_type,
    activity_data,
  } = activity;

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(activity_time), { addSuffix: true });
    } catch {
      return "recently";
    }
  }, [activity_time]);

  const displayName = full_name || username || "Unknown User";
  const avatarSrc = avatar_url || DEFAULT_AVATAR_URL;

  return (
    <div className="flex items-start space-x-3 py-3 border-b border-border/50 last:border-b-0">
      {/* User Avatar */}
      <Link href={`/profile/${username}`} className="flex-shrink-0">
        <Avatar className="h-10 w-10 hover:ring-2 hover:ring-yellow-400 transition-all">
          <AvatarImage src={avatarSrc} alt={displayName} />
          <AvatarFallback className="bg-yellow-100 text-yellow-700">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-yellow-600">
            {getActivityIcon(activity_type)}
          </span>
          <Link
            href={`/profile/${username}`}
            className="font-medium text-sm hover:text-yellow-600 transition-colors truncate"
          >
            {displayName}
          </Link>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {timeAgo}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {getActivityDescription(activity)}
        </p>

        {/* Additional badges for special activities */}
        <div className="flex items-center gap-2 mt-2">
          {activity_type === "achievement_unlock" && activity_data.rarity && (
            <Badge
              variant="outline"
              className={`text-xs ${getRarityColor(activity_data.rarity)}`}
            >
              {activity_data.achievement_icon} {activity_data.rarity}
            </Badge>
          )}

          {activity_type === "beer_count_update" &&
            activity_data.beer_count > 5 && (
              <Badge
                variant="outline"
                className="text-xs bg-orange-100 text-orange-800 border-orange-300"
              >
                🔥 Hot streak
              </Badge>
            )}
        </div>

        {/* Photo preview for photo uploads */}
        {activity_type === "photo_upload" && activity_data.picture_url && (
          <div className="mt-2">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
              <img
                src={activity_data.picture_url}
                alt="Activity photo"
                className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
