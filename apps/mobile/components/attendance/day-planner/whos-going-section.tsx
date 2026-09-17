import { useTranslation } from "@prostcounter/shared/i18n";
import type { FriendGoing } from "@prostcounter/shared/schemas";
import { formatTimeInTimezone } from "@prostcounter/shared/utils";
import { cn, getInitials } from "@prostcounter/ui";
import { parseISO } from "date-fns";
import { CalendarClock, Footprints, MapPin } from "lucide-react-native";
import { useState } from "react";

import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

/** Rows shown before "+N more". Enough to see who has a table without scrolling past the form. */
const COLLAPSED_COUNT = 3;

function FriendRow({ friend, timezone }: { friend: FriendGoing; timezone: string }) {
  const { t } = useTranslation();
  const displayName = friend.username || friend.fullName || t("attendance.planner.unknownFriend");
  const isReserved = friend.kind === "reservation";
  const statusLabel = isReserved ? t("attendance.list.reserved") : t("attendance.list.planning");
  const arrival = friend.startAt ? formatTimeInTimezone(parseISO(friend.startAt), timezone) : null;
  const details = [friend.tentName, arrival].filter(Boolean).join(" · ");

  return (
    <HStack
      space="md"
      className="items-start"
      accessible
      accessibilityLabel={[displayName, statusLabel, details, friend.note]
        .filter(Boolean)
        .join(", ")}
    >
      <Avatar size="sm">
        {friend.avatarUrl ? (
          <AvatarImage source={{ uri: getAvatarUrl(friend.avatarUrl) }} alt={displayName} />
        ) : (
          <AvatarFallbackText>
            {getInitials({ fullName: friend.fullName, username: friend.username })}
          </AvatarFallbackText>
        )}
      </Avatar>
      <VStack className="flex-1">
        <HStack space="sm" className="items-center justify-between">
          <Text className="flex-1 font-semibold text-typography-900" numberOfLines={1}>
            {displayName}
          </Text>
          <HStack
            space="xs"
            className={cn(
              "items-center rounded-full px-2 py-0.5",
              isReserved ? "bg-teal-100" : "border border-dashed border-teal-400",
            )}
          >
            {isReserved ? (
              <CalendarClock size={12} color={IconColors.reservation} />
            ) : (
              <Footprints size={12} color={IconColors.plan} />
            )}
            <Text className="text-xs font-semibold text-teal-700">{statusLabel}</Text>
          </HStack>
        </HStack>
        {details.length > 0 && (
          <HStack space="xs" className="items-center">
            <MapPin size={12} color={IconColors.muted} />
            <Text className="text-xs text-typography-600" numberOfLines={1}>
              {details}
            </Text>
          </HStack>
        )}
        {friend.note && (
          <Text className="text-xs italic text-typography-500">{`"${friend.note}"`}</Text>
        )}
      </VStack>
    </HStack>
  );
}

/**
 * Friends and group-mates with a visible plan or reservation on the day.
 * Renders nothing when nobody is going.
 */
export function WhosGoingSection({
  friends,
  timezone,
}: {
  friends: FriendGoing[];
  /** The festival's timezone, so arrival times read as they were booked. */
  timezone: string;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (friends.length === 0) {
    return null;
  }

  const visibleFriends = isExpanded ? friends : friends.slice(0, COLLAPSED_COUNT);
  const hiddenCount = friends.length - visibleFriends.length;

  return (
    <VStack space="sm">
      <HStack className="items-center justify-between">
        <Text className="text-base font-semibold text-typography-900">
          {t("attendance.planner.whosGoing")}
        </Text>
        <Text className="text-xs text-typography-500">
          {t("attendance.list.friendsCount", { count: friends.length })}
        </Text>
      </HStack>
      <VStack space="md">
        {visibleFriends.map((friend) => (
          <FriendRow key={friend.userId} friend={friend} timezone={timezone} />
        ))}
      </VStack>
      {hiddenCount > 0 && (
        <Pressable
          onPress={() => setIsExpanded(true)}
          className="items-center py-1"
          accessibilityRole="button"
        >
          <Text className="text-sm font-medium text-typography-500">
            {t("attendance.planner.moreFriends", { count: hiddenCount })}
          </Text>
        </Pressable>
      )}
    </VStack>
  );
}
