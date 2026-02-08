import type { LocationSessionMember, NearbyTent } from "@prostcounter/shared";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Beer, MapPin, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FriendMap } from "@/components/location/FriendMap";
import { LocationSharingToggle } from "@/components/location/LocationSharingToggle";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useLocationContext } from "@/lib/location";
import { useQuickAttendance } from "@/lib/quick-attendance";

/**
 * Full-screen map page with map, sharing controls, and nearby members list
 * Converted from LocationMapModal to fix z-index issues with global alerts
 */
export default function MapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentFestival } = useFestival();
  const { openSheet } = useQuickAttendance();
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

  const handleRefresh = useCallback(() => {
    if (currentFestival?.id) {
      refreshNearby(currentFestival.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFestival?.id]);

  // Add refresh button to header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleRefresh}
          disabled={isNearbyLoading}
          className="p-2"
          accessibilityLabel={t("common.actions.retry")}
        >
          <RefreshCw
            size={22}
            color={isNearbyLoading ? Colors.neutral[400] : IconColors.white}
          />
        </Pressable>
      ),
    });
  }, [navigation, isNearbyLoading, handleRefresh, t]);

  // Start local tracking when screen mounts (only if not already sharing)
  useEffect(() => {
    if (!currentFestival?.id) return;

    if (!isSharing && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startLocalTracking(currentFestival.id);
    }

    return () => {
      hasInitializedRef.current = false;
      if (!isSharing) {
        stopLocalTracking();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharing, currentFestival?.id]);

  // Select a tent (from list or map)
  const handleTentSelect = useCallback((tent: NearbyTent) => {
    setSelectedTent(tent);
    setSelectedTab("tents"); // Switch to tents tab to show selection
  }, []);

  // Check in at selected tent - closes map and opens quick attendance sheet
  const handleCheckIn = useCallback(() => {
    if (selectedTent) {
      router.back();
      setTimeout(() => {
        openSheet({
          tentId: selectedTent.tentId,
          tentName: selectedTent.tentName,
        });
      }, 150);
    }
  }, [selectedTent, router, openSheet]);

  const handleMarkerPress = useCallback(
    (type: "friend" | "tent", id: string) => {
      if (type === "tent") {
        const tent = nearbyTents.find((t) => t.tentId === id);
        if (tent) {
          handleTentSelect(tent);
        }
      } else {
        setSelectedTab("friends");
      }
    },
    [nearbyTents, handleTentSelect],
  );

  if (!currentFestival?.id) {
    return null;
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 16,
      }}
    >
      {/* Map */}
      <Box className="mx-3 mb-2 mt-3 h-[250px] overflow-hidden rounded-2xl">
        <FriendMap
          showFriends
          showTents
          searchRadius={1000}
          selectedTentId={selectedTent?.tentId}
          onMarkerPress={handleMarkerPress}
        />
      </Box>

      {/* Sharing toggle - global alerts work normally here */}
      <Box className="px-3 py-1">
        <LocationSharingToggle festivalId={currentFestival.id} />
      </Box>

      {/* Tabs */}
      <HStack className="px-3 py-1" space="sm">
        <Pressable
          onPress={() => setSelectedTab("friends")}
          className={cn(
            "flex-1 rounded-lg py-2",
            selectedTab === "friends" ? "bg-primary-500" : "bg-background-100",
          )}
        >
          <Text
            className={cn(
              "text-center font-medium",
              selectedTab === "friends" ? "text-white" : "text-typography-600",
            )}
          >
            {t("location.tabs.friends")} ({nearbyMembers.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedTab("tents")}
          className={cn(
            "flex-1 rounded-lg py-2",
            selectedTab === "tents" ? "bg-primary-500" : "bg-background-100",
          )}
        >
          <Text
            className={cn(
              "text-center font-medium",
              selectedTab === "tents" ? "text-white" : "text-typography-600",
            )}
          >
            {t("location.tabs.tents")} ({nearbyTents.length})
          </Text>
        </Pressable>
      </HStack>

      {/* List */}
      <Box className="px-3">
        {selectedTab === "friends" ? (
          <NearbyFriendsList members={nearbyMembers} />
        ) : (
          <NearbyTentsList
            tents={nearbyTents}
            selectedTentId={selectedTent?.tentId ?? null}
            onTentSelect={handleTentSelect}
            onCheckIn={handleCheckIn}
          />
        )}
      </Box>
    </ScrollView>
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

function NearbyTentsList({
  tents,
  selectedTentId,
  onTentSelect,
  onCheckIn,
}: NearbyTentsListProps) {
  const { t } = useTranslation();

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
    <VStack space="xs">
      {tents.map((tent) => {
        const isSelected = tent.tentId === selectedTentId;
        return (
          <Pressable
            key={tent.tentId}
            onPress={() => onTentSelect(tent)}
            className="mb-1 active:opacity-70"
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
      })}
    </VStack>
  );
}
