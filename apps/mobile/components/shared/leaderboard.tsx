import { useTranslation } from "@prostcounter/shared/i18n";
import type { LeaderboardEntry } from "@prostcounter/shared/schemas";
import type { WinningCriteria } from "@prostcounter/shared/schemas";
import { Trophy, Medal, Calendar, Beer, TrendingUp, X } from "lucide-react-native";
import { useState, useCallback } from "react";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getInitials } from "@prostcounter/ui";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  winningCriteria: WinningCriteria;
  currentUserId?: string;
  emptyMessage?: string;
}

// Position badge colors
const POSITION_COLORS = {
  1: { bg: "bg-yellow-100", icon: Colors.primary[500] },
  2: { bg: "bg-gray-100", icon: Colors.gray[400] },
  3: { bg: "bg-orange-100", icon: "#CD7F32" },
} as const;

/**
 * Compact table-style leaderboard component
 * Shows ranked entries with stats in aligned columns
 */
export function Leaderboard({
  entries,
  winningCriteria,
  currentUserId,
  emptyMessage,
}: LeaderboardProps) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);

  const handleUserPress = useCallback((entry: LeaderboardEntry) => {
    setSelectedUser(entry);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedUser(null);
  }, []);

  if (entries.length === 0) {
    return (
      <Card variant="outline" size="md" className="items-center bg-white p-6">
        <Trophy size={48} color={IconColors.disabled} />
        <Text className="mt-2 text-center text-typography-500">
          {emptyMessage ||
            t("leaderboard.empty", { defaultValue: "No entries yet" })}
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Card variant="outline" size="sm" className="bg-white p-0">
        {/* Header Row */}
        <HStack className="border-b border-outline-100 px-3 py-2.5">
          <Text className="flex-1 text-sm font-medium text-typography-500">
            {t("leaderboard.header.player", { defaultValue: "Player" })}
          </Text>
          <HStack className="w-14 items-center justify-center" space="xs">
            <Calendar size={14} color={IconColors.muted} />
          </HStack>
          <HStack className="w-14 items-center justify-center" space="xs">
            <Beer size={14} color={IconColors.muted} />
          </HStack>
          <HStack className="w-12 items-center justify-center" space="xs">
            <TrendingUp size={14} color={IconColors.muted} />
          </HStack>
        </HStack>

        {/* Data Rows */}
        <VStack>
          {entries.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;
            const isTopThree = entry.position <= 3;
            const positionStyle = isTopThree
              ? POSITION_COLORS[entry.position as 1 | 2 | 3]
              : null;
            const isLast = index === entries.length - 1;

            const displayName = entry.username || entry.fullName || "Unknown";

            return (
              <Pressable
                key={entry.userId}
                onPress={() => handleUserPress(entry)}
              >
                <HStack
                  className={`items-center px-3 py-2.5 ${
                    isCurrentUser ? "bg-primary-50" : ""
                  } ${!isLast ? "border-b border-outline-50" : ""}`}
                >
                  {/* Position + Avatar + Name */}
                  <HStack className="flex-1 items-center" space="sm">
                    {/* Position indicator */}
                    {isTopThree ? (
                      <VStack
                        className={`h-7 w-7 items-center justify-center rounded-full ${positionStyle?.bg}`}
                      >
                        {entry.position === 1 ? (
                          <Trophy size={14} color={positionStyle?.icon} />
                        ) : (
                          <Medal size={14} color={positionStyle?.icon} />
                        )}
                      </VStack>
                    ) : (
                      <VStack className="h-7 w-7 items-center justify-center">
                        <Text className="text-sm font-semibold text-typography-400">
                          {entry.position}
                        </Text>
                      </VStack>
                    )}

                    {/* Avatar */}
                    <Avatar size="sm">
                      {entry.avatarUrl ? (
                        <AvatarImage
                          source={{ uri: getAvatarUrl(entry.avatarUrl) }}
                          alt={displayName}
                        />
                      ) : (
                        <AvatarFallbackText>
                          {getInitials({ fullName: entry.fullName, username: entry.username })}
                        </AvatarFallbackText>
                      )}
                    </Avatar>

                    {/* Name */}
                    <Text
                      className={`flex-1 text-sm ${
                        isCurrentUser
                          ? "font-semibold text-primary-700"
                          : "text-typography-900"
                      }`}
                      numberOfLines={1}
                    >
                      {displayName}
                      {isCurrentUser && (
                        <Text className="text-xs text-typography-500"> (You)</Text>
                      )}
                    </Text>
                  </HStack>

                  {/* Stats - aligned with headers */}
                  <Text className="w-14 text-center text-sm font-semibold text-typography-800">
                    {entry.daysAttended ?? 0}
                  </Text>
                  <Text className="w-14 text-center text-sm font-semibold text-typography-800">
                    {entry.totalBeers ?? 0}
                  </Text>
                  <Text className="w-12 text-center text-sm font-semibold text-typography-800">
                    {typeof entry.avgBeers === "number"
                      ? entry.avgBeers.toFixed(1)
                      : "0.0"}
                  </Text>
                </HStack>
              </Pressable>
            );
          })}
        </VStack>
      </Card>

      {/* User Detail Modal */}
      <Modal isOpen={!!selectedUser} onClose={handleCloseModal} size="sm">
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="md" className="text-typography-900">
              {t("leaderboard.userDetail.title", { defaultValue: "Player Profile" })}
            </Heading>
            <ModalCloseButton>
              <X size={20} color={IconColors.default} />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedUser && (
              <VStack space="md" className="items-center">
                {/* Large Avatar */}
                <Avatar size="xl">
                  {selectedUser.avatarUrl ? (
                    <AvatarImage
                      source={{ uri: getAvatarUrl(selectedUser.avatarUrl) }}
                      alt={selectedUser.fullName || selectedUser.username || "User"}
                    />
                  ) : (
                    <AvatarFallbackText>
                      {getInitials({ fullName: selectedUser.fullName, username: selectedUser.username })}
                    </AvatarFallbackText>
                  )}
                </Avatar>

                {/* User Info */}
                <VStack space="xs" className="items-center">
                  {selectedUser.fullName && (
                    <Text className="text-lg font-semibold text-typography-900">
                      {selectedUser.fullName}
                    </Text>
                  )}
                  {selectedUser.username && (
                    <Text className="text-sm text-typography-500">
                      @{selectedUser.username}
                    </Text>
                  )}
                </VStack>

                {/* Stats */}
                <HStack space="lg" className="mt-2">
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <Calendar size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {selectedUser.daysAttended ?? 0}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.metric.days", { defaultValue: "days" })}
                    </Text>
                  </VStack>
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <Beer size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {selectedUser.totalBeers ?? 0}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.metric.beers", { defaultValue: "beers" })}
                    </Text>
                  </VStack>
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <TrendingUp size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {typeof selectedUser.avgBeers === "number"
                          ? selectedUser.avgBeers.toFixed(1)
                          : "0.0"}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.metric.avgBeers", { defaultValue: "avg" })}
                    </Text>
                  </VStack>
                </HStack>

                {/* Position Badge */}
                {selectedUser.position <= 3 && (
                  <HStack
                    space="xs"
                    className={`mt-2 items-center rounded-full px-3 py-1 ${
                      POSITION_COLORS[selectedUser.position as 1 | 2 | 3]?.bg
                    }`}
                  >
                    {selectedUser.position === 1 ? (
                      <Trophy
                        size={16}
                        color={POSITION_COLORS[1].icon}
                      />
                    ) : (
                      <Medal
                        size={16}
                        color={POSITION_COLORS[selectedUser.position as 2 | 3]?.icon}
                      />
                    )}
                    <Text className="text-sm font-medium text-typography-800">
                      #{selectedUser.position}
                    </Text>
                  </HStack>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

Leaderboard.displayName = "Leaderboard";
