import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { format } from "date-fns";
import { UserMinus, Crown, Users } from "lucide-react-native";

import type { GroupMember } from "@prostcounter/shared/schemas";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface GroupMembersListProps {
  members: GroupMember[];
  currentUserId?: string;
  creatorId: string;
  isCreator: boolean;
  onRemoveMember?: (userId: string, memberName: string) => void;
  isRemoving?: boolean;
}

export function GroupMembersList({
  members,
  currentUserId,
  creatorId,
  isCreator,
  onRemoveMember,
  isRemoving,
}: GroupMembersListProps) {
  const { t } = useTranslation();

  if (members.length === 0) {
    return (
      <Card variant="outline" size="md" className="items-center p-6">
        <Users size={48} color={IconColors.disabled} />
        <Text className="mt-2 text-center text-typography-500">
          {t("groups.members.empty")}
        </Text>
      </Card>
    );
  }

  return (
    <VStack space="sm">
      {members.map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const isMemberCreator = member.userId === creatorId;
        const displayName = member.fullName || member.username || "Unknown";
        const initials = displayName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        const canRemove = isCreator && !isMemberCreator && !isCurrentUser;
        const joinedDate = member.joinedAt
          ? format(new Date(member.joinedAt), "MMM d, yyyy")
          : null;

        return (
          <Card
            key={member.userId}
            variant="outline"
            size="sm"
            className={cn(isCurrentUser && "border-primary-200 bg-primary-50")}
          >
            <HStack className="items-center justify-between">
              <HStack space="md" className="flex-1 items-center">
                <Avatar size="sm">
                  {member.avatarUrl ? (
                    <AvatarImage source={{ uri: member.avatarUrl }} />
                  ) : (
                    <AvatarFallbackText>{initials}</AvatarFallbackText>
                  )}
                </Avatar>

                <VStack className="flex-1">
                  <HStack space="xs" className="items-center">
                    <Text
                      className={cn(
                        "font-medium",
                        isCurrentUser && "text-primary-600",
                        !isCurrentUser && "text-typography-900",
                      )}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                    {isMemberCreator && (
                      <Crown size={14} color={IconColors.primary} />
                    )}
                    {isCurrentUser && (
                      <Text className="text-xs text-typography-400">
                        {t("groups.members.you")}
                      </Text>
                    )}
                  </HStack>
                  {member.username && member.fullName && (
                    <Text className="text-xs text-typography-400">
                      @{member.username}
                    </Text>
                  )}
                  {joinedDate && (
                    <Text className="text-xs text-typography-400">
                      {t("groups.members.joined", {
                        date: joinedDate,
                      })}
                    </Text>
                  )}
                </VStack>
              </HStack>

              {canRemove && onRemoveMember && (
                <Button
                  variant="ghost"
                  action="negative"
                  size="icon"
                  onPress={() => onRemoveMember(member.userId, displayName)}
                  isDisabled={isRemoving}
                >
                  <UserMinus size={18} color={IconColors.error} />
                </Button>
              )}
            </HStack>
          </Card>
        );
      })}
    </VStack>
  );
}

GroupMembersList.displayName = "GroupMembersList";
