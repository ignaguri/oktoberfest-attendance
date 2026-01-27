import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { useCallback, useMemo, useState } from "react";
import { Platform, View } from "react-native";

import { Text } from "@/components/ui/text";
import { BackgroundColors, Colors } from "@/lib/constants/colors";
import { useLocationContext } from "@/lib/location";

interface FriendMapProps {
  showTents?: boolean;
  showFriends?: boolean;
  searchRadius?: number;
  selectedTentId?: string | null;
  onMarkerPress?: (type: "friend" | "tent", id: string) => void;
  style?: object;
}

/**
 * Map component showing friends, tents, and user location
 * Uses expo-maps for reliable marker touch events
 * - iOS: Apple Maps with SF Symbols
 * - Android: Google Maps with default markers
 */
export function FriendMap({
  showTents = true,
  showFriends = true,
  searchRadius = 1000,
  selectedTentId,
  onMarkerPress,
  style,
}: FriendMapProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const {
    currentLocation,
    nearbyMembers,
    nearbyTents,
    isSharing,
    isNearbyLoading,
  } = useLocationContext();

  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  // Calculate initial camera position: user location > festival region
  // Returns null if neither is available (map will show default world view)
  const cameraPosition = useMemo(() => {
    // Priority 1: User's current location
    if (currentLocation) {
      return {
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        zoom: 16,
      };
    }
    // Priority 2: Festival's configured coordinates
    if (currentFestival?.latitude && currentFestival?.longitude) {
      return {
        coordinates: {
          latitude: currentFestival.latitude,
          longitude: currentFestival.longitude,
        },
        zoom: 15,
      };
    }
    // No location available - let map use default view
    return undefined;
  }, [currentLocation, currentFestival]);

  // Build Apple Maps markers (iOS) - with SF Symbols
  const appleMarkers = useMemo<AppleMaps.Marker[]>(() => {
    const result: AppleMaps.Marker[] = [];

    // User location marker
    if (currentLocation) {
      result.push({
        id: "user-location",
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        title: t("location.map.yourLocation"),
        systemImage: isSharing ? "location.fill" : "location.circle.fill",
        tintColor: isSharing ? Colors.success[500] : Colors.primary[500],
      });
    }

    // Friend markers
    if (showFriends) {
      nearbyMembers.forEach((member) => {
        if (member.lastLocation) {
          result.push({
            id: `friend-${member.userId}`,
            coordinates: {
              latitude: member.lastLocation.latitude,
              longitude: member.lastLocation.longitude,
            },
            title: member.fullName || member.username || "Friend",
            systemImage: "person.fill",
            tintColor:
              selectedFriendId === member.userId
                ? Colors.primary[700]
                : Colors.primary[500],
          });
        }
      });
    }

    // Tent markers
    if (showTents) {
      nearbyTents.forEach((tent) => {
        const tintColor =
          tent.category === "large"
            ? Colors.primary[500]
            : tent.category === "old"
              ? Colors.amber[600]
              : Colors.amber[400];

        result.push({
          id: `tent-${tent.tentId}`,
          coordinates: {
            latitude: tent.latitude,
            longitude: tent.longitude,
          },
          title: tent.tentName,
          systemImage: "tent.fill",
          tintColor:
            selectedTentId === tent.tentId ? Colors.primary[700] : tintColor,
        });
      });
    }

    return result;
  }, [
    currentLocation,
    showFriends,
    showTents,
    nearbyMembers,
    nearbyTents,
    selectedFriendId,
    selectedTentId,
    isSharing,
    t,
  ]);

  // Build Google Maps markers (Android) - default markers with titles
  const googleMarkers = useMemo<GoogleMaps.Marker[]>(() => {
    const result: GoogleMaps.Marker[] = [];

    // User location marker
    if (currentLocation) {
      result.push({
        id: "user-location",
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        title: t("location.map.yourLocation"),
        snippet: isSharing
          ? t("location.sharing.active", { defaultValue: "Sharing location" })
          : undefined,
      });
    }

    // Friend markers
    if (showFriends) {
      nearbyMembers.forEach((member) => {
        if (member.lastLocation) {
          result.push({
            id: `friend-${member.userId}`,
            coordinates: {
              latitude: member.lastLocation.latitude,
              longitude: member.lastLocation.longitude,
            },
            title: member.fullName || member.username || "Friend",
            snippet: member.groupName || undefined,
          });
        }
      });
    }

    // Tent markers
    if (showTents) {
      nearbyTents.forEach((tent) => {
        result.push({
          id: `tent-${tent.tentId}`,
          coordinates: {
            latitude: tent.latitude,
            longitude: tent.longitude,
          },
          title: tent.tentName,
          snippet: tent.beerPrice
            ? `${Math.round(tent.distanceMeters)}m • €${tent.beerPrice.toFixed(2)}`
            : `${Math.round(tent.distanceMeters)}m`,
        });
      });
    }

    return result;
  }, [
    currentLocation,
    showFriends,
    showTents,
    nearbyMembers,
    nearbyTents,
    isSharing,
    t,
  ]);

  // Quantize location to ~10m precision to avoid frequent circle re-renders
  const rawLatitude = currentLocation?.coords.latitude;
  const rawLongitude = currentLocation?.coords.longitude;

  const roundedLatitude = useMemo(
    () =>
      typeof rawLatitude === "number" ? Number(rawLatitude.toFixed(4)) : null,
    [rawLatitude],
  );

  const roundedLongitude = useMemo(
    () =>
      typeof rawLongitude === "number" ? Number(rawLongitude.toFixed(4)) : null,
    [rawLongitude],
  );

  const roundedRadius = useMemo(
    () =>
      typeof searchRadius === "number" && !Number.isNaN(searchRadius)
        ? Math.round(searchRadius)
        : undefined,
    [searchRadius],
  );

  // Build circles array for search radius (works on both platforms)
  const appleCircles = useMemo(() => {
    if (
      roundedLatitude == null ||
      roundedLongitude == null ||
      roundedRadius == null
    ) {
      return [];
    }

    return [
      {
        id: "search-radius",
        center: {
          latitude: roundedLatitude,
          longitude: roundedLongitude,
        },
        radius: roundedRadius,
        color: `${Colors.primary[500]}10`,
        lineColor: `${Colors.primary[500]}50`,
        lineWidth: 1,
      },
    ];
  }, [roundedLatitude, roundedLongitude, roundedRadius]);

  const googleCircles = useMemo(() => {
    if (
      roundedLatitude == null ||
      roundedLongitude == null ||
      roundedRadius == null
    ) {
      return [];
    }

    return [
      {
        id: "search-radius",
        center: {
          latitude: roundedLatitude,
          longitude: roundedLongitude,
        },
        radius: roundedRadius,
        color: `${Colors.primary[500]}20`,
        lineColor: `${Colors.primary[500]}80`,
        lineWidth: 2,
      },
    ];
  }, [roundedLatitude, roundedLongitude, roundedRadius]);

  // Handle marker click - works for both platforms
  const handleMarkerClick = useCallback(
    (marker: AppleMaps.Marker | GoogleMaps.Marker) => {
      const markerId = marker.id;
      if (!markerId || markerId === "user-location") {
        return; // Ignore user location marker clicks
      }

      if (markerId.startsWith("tent-")) {
        const tentId = markerId.replace("tent-", "");
        onMarkerPress?.("tent", tentId);
      } else if (markerId.startsWith("friend-")) {
        const friendId = markerId.replace("friend-", "");
        setSelectedFriendId(friendId);
        onMarkerPress?.("friend", friendId);
      }
    },
    [onMarkerPress],
  );

  // Render the map based on platform
  const renderMap = () => {
    if (Platform.OS === "ios") {
      return (
        <AppleMaps.View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          cameraPosition={cameraPosition}
          markers={appleMarkers}
          circles={appleCircles}
          onMarkerClick={handleMarkerClick}
          uiSettings={{
            compassEnabled: true,
            scaleBarEnabled: true,
          }}
          properties={{
            isMyLocationEnabled: false,
          }}
        />
      );
    }

    // Android - Google Maps
    return (
      <GoogleMaps.View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        cameraPosition={cameraPosition}
        markers={googleMarkers}
        circles={googleCircles}
        onMarkerClick={handleMarkerClick}
        uiSettings={{
          compassEnabled: true,
          scaleBarEnabled: true,
          zoomControlsEnabled: true,
          myLocationButtonEnabled: false,
        }}
        properties={{
          isMyLocationEnabled: false,
        }}
      />
    );
  };

  return (
    <View
      className="flex-1 overflow-hidden rounded-xl"
      style={[{ backgroundColor: BackgroundColors[100] }, style]}
    >
      {renderMap()}

      {/* Loading indicator */}
      {isNearbyLoading && (
        <View className="absolute left-2.5 top-2.5 rounded-2xl bg-white/90 px-3 py-1.5">
          <Text className="text-typography-500 text-sm">
            {t("location.map.loading")}
          </Text>
        </View>
      )}

      {/* Stats overlay */}
      <View className="absolute bottom-2.5 left-2.5 flex-row gap-2">
        {showFriends && nearbyMembers.length > 0 && (
          <View
            className="rounded-xl px-2.5 py-1"
            style={{ backgroundColor: Colors.primary[500] }}
          >
            <Text className="text-xs font-medium text-white">
              {t("location.map.friendsNearby", { count: nearbyMembers.length })}
            </Text>
          </View>
        )}
        {showTents && nearbyTents.length > 0 && (
          <View
            className="rounded-xl px-2.5 py-1"
            style={{ backgroundColor: Colors.amber[500] }}
          >
            <Text className="text-xs font-medium text-white">
              {t("location.map.tentsNearby", { count: nearbyTents.length })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
