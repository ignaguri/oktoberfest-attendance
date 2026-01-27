import { cn, getInitials } from "@prostcounter/ui";
import { Beer } from "lucide-react-native";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";
import { Colors } from "@/lib/constants/colors";

interface FriendMarkerProps {
  avatarUrl: string | null;
  username: string;
  isSelected?: boolean;
}

/**
 * Custom map marker for friends with avatar
 */
export function FriendMarker({
  avatarUrl,
  username,
  isSelected = false,
}: FriendMarkerProps) {
  return (
    <View className="items-center">
      <View
        className={cn(
          "rounded-full border-2 p-1",
          isSelected ? "border-primary-500" : "border-white",
        )}
        style={{
          backgroundColor: Colors.white,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="h-8 w-8 rounded-full"
            accessibilityLabel={`${username}'s avatar`}
          />
        ) : (
          <View className="bg-primary-100 h-8 w-8 items-center justify-center rounded-full">
            <Text className="text-primary-700 text-sm font-bold">
              {getInitials({ username })}
            </Text>
          </View>
        )}
      </View>
      {/* Pointer triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: isSelected ? Colors.primary[500] : Colors.white,
          marginTop: -2,
        }}
      />
    </View>
  );
}

interface TentMarkerProps {
  tentName: string;
  category: string | null;
  distanceMeters: number;
  isSelected?: boolean;
}

/**
 * Custom map marker for tents
 */
export function TentMarker({
  tentName,
  category,
  distanceMeters,
  isSelected = false,
}: TentMarkerProps) {
  // Use different colors based on tent category
  const markerColor =
    category === "large"
      ? Colors.primary[500]
      : category === "old"
        ? Colors.amber[600]
        : Colors.amber[400];

  return (
    <View className="items-center">
      <View
        className={cn(
          "rounded-lg px-2 py-1",
          isSelected && "border-primary-700 border-2",
        )}
        style={{
          backgroundColor: markerColor,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="flex-row items-center gap-1">
          <Beer size={14} color="white" />
          {distanceMeters < 100 && (
            <Text className="text-xs font-medium text-white">
              {Math.round(distanceMeters)}m
            </Text>
          )}
        </View>
      </View>
      {/* Pointer triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: markerColor,
          marginTop: -1,
        }}
      />
    </View>
  );
}

interface UserLocationMarkerProps {
  isSharing: boolean;
  avatarUrl?: string | null;
  username?: string | null;
  fullName?: string | null;
}

/**
 * Custom marker for user's current location
 * Shows user's avatar if available, otherwise shows initials or a pin icon
 */
export function UserLocationMarker({
  isSharing,
  avatarUrl,
  username,
  fullName,
}: UserLocationMarkerProps) {
  const borderColor = isSharing ? Colors.success[500] : Colors.primary[500];
  const initials = getInitials({ fullName, username });

  return (
    <View className="items-center">
      {/* Avatar or fallback */}
      <View
        className="border-3 rounded-full p-0.5"
        style={{
          borderWidth: 3,
          borderColor,
          backgroundColor: Colors.white,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="h-10 w-10 rounded-full"
            accessibilityLabel="Your location"
          />
        ) : (
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: borderColor }}
          >
            <Text className="text-lg font-bold text-white">{initials}</Text>
          </View>
        )}
      </View>

      {/* Pointer triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: borderColor,
          marginTop: -2,
        }}
      />

      {/* Pulsing effect for sharing */}
      {isSharing && (
        <View
          className="absolute rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: `${Colors.success[500]}25`,
            top: -3,
          }}
        />
      )}
    </View>
  );
}
