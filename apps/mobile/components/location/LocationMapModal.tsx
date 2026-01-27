import type { LocationSessionMember, NearbyTent } from "@prostcounter/shared";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { Beer, MapPin, RefreshCw, X } from "lucide-react-native";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useLocationContext } from "@/lib/location";

import { FriendMap } from "./FriendMap";
import { LocationSharingToggle } from "./LocationSharingToggle";

interface LocationMapModalProps {
  visible: boolean;
  onClose: () => void;
  festivalId: string;
  onTentSelect?: (tentId: string, tentName: string) => void;
}

/**
 * Full-screen modal with map, sharing controls, and nearby members list
 */
export function LocationMapModal({
  visible,
  onClose,
  festivalId,
  onTentSelect,
}: LocationMapModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    nearbyMembers,
    nearbyTents,
    isNearbyLoading,
    refreshNearby,
    isSharing,
    startLocalTracking,
    stopLocalTracking,
  } = useLocationContext();

  const [selectedTab, setSelectedTab] = useState<"friends" | "tents">(
    "friends",
  );
  const [selectedTent, setSelectedTent] = useState<NearbyTent | null>(null);
  const hasInitializedRef = useRef(false);
  const tentsListRef = useRef<FlatList<NearbyTent>>(null);

  // Start local tracking when modal opens (only if not already sharing)
  // startLocalTracking will fetch nearby tents immediately with the location
  useEffect(() => {
    if (visible && !isSharing && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startLocalTracking(festivalId);
    }

    // Reset when modal closes
    if (!visible) {
      hasInitializedRef.current = false;
      if (!isSharing) {
        stopLocalTracking();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isSharing, festivalId]);

  const handleRefresh = useCallback(() => {
    refreshNearby(festivalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivalId]);

  // Select a tent (from list or map)
  const handleTentSelect = useCallback(
    (tent: NearbyTent, scrollToItem = false) => {
      setSelectedTent(tent);
      setSelectedTab("tents"); // Switch to tents tab to show selection

      // Scroll to the tent in the list if triggered from map marker
      if (scrollToItem) {
        const index = nearbyTents.findIndex((t) => t.tentId === tent.tentId);
        if (index !== -1 && tentsListRef.current) {
          // Longer delay to ensure tab switch and list layout complete (per PR comment)
          setTimeout(() => {
            tentsListRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.3, // Position item towards top
            });
          }, 250);
        }
      }
    },
    [nearbyTents],
  );

  // Check in at selected tent - closes modal and opens FAB
  const handleCheckIn = useCallback(() => {
    if (selectedTent && onTentSelect) {
      onTentSelect(selectedTent.tentId, selectedTent.tentName);
      onClose();
    }
  }, [selectedTent, onTentSelect, onClose]);

  const handleMarkerPress = useCallback(
    (type: "friend" | "tent", id: string) => {
      if (type === "tent") {
        // Find the tent and select it, scroll to it in the list
        const tent = nearbyTents.find((t) => t.tentId === id);
        if (tent) {
          handleTentSelect(tent, true); // true = scroll to item
        }
      } else {
        setSelectedTab("friends");
      }
    },
    [nearbyTents, handleTentSelect],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <Box className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <HStack className="items-center justify-between px-4 py-2">
          <Heading size="lg">{t("location.map.title")}</Heading>
          <HStack space="sm">
            <Pressable
              onPress={handleRefresh}
              disabled={isNearbyLoading}
              className="p-2"
              accessibilityLabel={t("common.actions.retry")}
            >
              <RefreshCw
                size={22}
                color={
                  isNearbyLoading ? Colors.neutral[400] : IconColors.default
                }
              />
            </Pressable>
            <Pressable
              onPress={onClose}
              className="p-2"
              accessibilityLabel={t("common.buttons.close")}
            >
              <X size={24} color={IconColors.default} />
            </Pressable>
          </HStack>
        </HStack>

        {/* Map */}
        <Box className="mx-3 mb-2 h-[200px] overflow-hidden rounded-2xl">
          <FriendMap
            showFriends
            showTents
            searchRadius={1000}
            selectedTentId={selectedTent?.tentId}
            onMarkerPress={handleMarkerPress}
          />
        </Box>

        {/* Bottom panel */}
        <Box
          className="flex-1 bg-white"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {/* Sharing toggle */}
          <Box className="px-3 py-1">
            <LocationSharingToggle festivalId={festivalId} />
          </Box>

          {/* Tabs */}
          <HStack className="px-3 py-1" space="sm">
            <Pressable
              onPress={() => setSelectedTab("friends")}
              className={cn(
                "flex-1 rounded-lg py-2",
                selectedTab === "friends"
                  ? "bg-primary-500"
                  : "bg-background-100",
              )}
            >
              <Text
                className={cn(
                  "text-center font-medium",
                  selectedTab === "friends"
                    ? "text-white"
                    : "text-typography-600",
                )}
              >
                {t("location.tabs.friends")} ({nearbyMembers.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedTab("tents")}
              className={cn(
                "flex-1 rounded-lg py-2",
                selectedTab === "tents"
                  ? "bg-primary-500"
                  : "bg-background-100",
              )}
            >
              <Text
                className={cn(
                  "text-center font-medium",
                  selectedTab === "tents"
                    ? "text-white"
                    : "text-typography-600",
                )}
              >
                {t("location.tabs.tents")} ({nearbyTents.length})
              </Text>
            </Pressable>
          </HStack>

          {/* List */}
          {selectedTab === "friends" ? (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <NearbyFriendsList members={nearbyMembers} />
            </ScrollView>
          ) : (
            <NearbyTentsList
              ref={tentsListRef}
              tents={nearbyTents}
              selectedTentId={selectedTent?.tentId ?? null}
              onTentSelect={(tent) => handleTentSelect(tent, false)}
              onCheckIn={handleCheckIn}
            />
          )}
        </Box>
      </Box>
    </Modal>
  );
}

function NearbyFriendsList({ members }: { members: LocationSessionMember[] }) {
  const { t } = useTranslation();

  if (members.length === 0) {
    return (
      <Box className="items-center p-8">
        <MapPin size={40} color={Colors.neutral[400]} />
        <Text className="mt-4 text-center text-typography-500">
          {t("location.noFriendsNearby")}
        </Text>
      </Box>
    );
  }

  return (
    <VStack space="xs" className="px-3">
      {members.map((member) => (
        <Card key={member.userId} size="sm" variant="outline" className="p-2">
          <HStack space="sm" className="items-center">
            <Avatar size="sm">
              {member.avatarUrl && (
                <AvatarImage source={{ uri: member.avatarUrl }} />
              )}
              <AvatarFallbackText>
                {member.username || member.fullName || "?"}
              </AvatarFallbackText>
            </Avatar>
            <VStack className="flex-1">
              <Text className="font-medium text-typography-900">
                {member.fullName || member.username}
              </Text>
              <Text className="text-sm text-typography-500">
                {member.groupName}
              </Text>
            </VStack>
            {member.distance !== null && (
              <Text className="text-sm text-typography-500">
                {Math.round(member.distance)}m
              </Text>
            )}
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

interface NearbyTentsListProps {
  tents: NearbyTent[];
  selectedTentId: string | null;
  onTentSelect: (tent: NearbyTent) => void;
  onCheckIn: () => void;
}

const NearbyTentsList = forwardRef<FlatList<NearbyTent>, NearbyTentsListProps>(
  function NearbyTentsList(
    { tents, selectedTentId, onTentSelect, onCheckIn },
    ref,
  ) {
    const { t } = useTranslation();

    const renderTentItem = useCallback(
      ({ item: tent }: { item: NearbyTent }) => {
        const isSelected = tent.tentId === selectedTentId;
        return (
          <Pressable
            onPress={() => onTentSelect(tent)}
            className="mx-3 mb-1 active:opacity-70"
          >
            <Card
              size="sm"
              variant="outline"
              className="p-2"
              style={
                isSelected
                  ? { borderColor: Colors.primary[500], borderWidth: 2 }
                  : undefined
              }
            >
              <HStack space="sm" className="items-center">
                <Box
                  className="rounded-full p-1.5"
                  style={{
                    backgroundColor:
                      tent.category === "large"
                        ? `${Colors.primary[500]}20`
                        : tent.category === "old"
                          ? `${Colors.amber[600]}20`
                          : `${Colors.amber[400]}20`,
                  }}
                >
                  <Beer
                    size={16}
                    color={
                      tent.category === "large"
                        ? Colors.primary[500]
                        : tent.category === "old"
                          ? Colors.amber[600]
                          : Colors.amber[400]
                    }
                  />
                </Box>
                <VStack className="flex-1">
                  <Text className="font-medium text-typography-900">
                    {tent.tentName}
                  </Text>
                  <Text className="text-sm capitalize text-typography-500">
                    {tent.category || "tent"}
                  </Text>
                </VStack>
                {isSelected ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onCheckIn();
                    }}
                    className="rounded-lg bg-primary-500 px-3 py-1.5 active:bg-primary-600"
                    accessibilityLabel={t("location.checkInAt", {
                      tent: tent.tentName,
                    })}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {t("location.checkIn")}
                    </Text>
                  </Pressable>
                ) : (
                  <VStack className="items-end">
                    <Text className="text-sm font-medium text-typography-700">
                      {Math.round(tent.distanceMeters)}m
                    </Text>
                    {tent.beerPrice && (
                      <Text className="text-xs text-typography-500">
                        {"\u20AC"}
                        {tent.beerPrice.toFixed(2)}
                      </Text>
                    )}
                  </VStack>
                )}
              </HStack>
            </Card>
          </Pressable>
        );
      },
      [selectedTentId, onTentSelect, onCheckIn, t],
    );

    if (tents.length === 0) {
      return (
        <Box className="items-center p-8">
          <Beer size={40} color={Colors.neutral[400]} />
          <Text className="mt-4 text-center text-typography-500">
            {t("location.noTentsNearby")}
          </Text>
        </Box>
      );
    }

    return (
      <Box className="flex-1">
        <FlatList
          ref={ref}
          data={tents}
          renderItem={renderTentItem}
          keyExtractor={(tent) => tent.tentId}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Fallback: scroll to offset if index fails (increased delay per PR comment)
            setTimeout(() => {
              ref &&
                "current" in ref &&
                ref.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
            }, 250);
          }}
        />
      </Box>
    );
  },
);
