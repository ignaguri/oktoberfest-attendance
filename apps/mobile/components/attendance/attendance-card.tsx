import { useMemo } from "react";
import { Image } from "react-native";
import { Beer, MapPin, Camera } from "lucide-react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export interface AttendanceData {
  id: string;
  date: string;
  beerCount: number;
  festivalId: string;
  createdAt: string | null;
  updatedAt: string | null;
  // Extended data that may come from API joins
  tentVisits?: Array<{
    id: string;
    tentId: string;
    tent?: { name: string };
  }>;
  beerPictures?: Array<{
    id: string;
    pictureUrl: string;
  }>;
}

interface AttendanceCardProps {
  attendance: AttendanceData;
  onPress: (attendance: AttendanceData) => void;
}

/**
 * Attendance card showing date, beer count, tent count, and photo thumbnails
 */
export function AttendanceCard({ attendance, onPress }: AttendanceCardProps) {
  // Format date for display
  const formattedDate = useMemo(() => {
    const date = new Date(attendance.date);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [attendance.date]);

  const tentCount = attendance.tentVisits?.length ?? 0;
  const photoCount = attendance.beerPictures?.length ?? 0;
  const photos = attendance.beerPictures?.slice(0, 3) ?? [];

  return (
    <Pressable onPress={() => onPress(attendance)}>
      <Card className="p-4 mb-3 bg-background-0">
        <HStack className="items-center justify-between">
          {/* Left side: Date and stats */}
          <VStack className="flex-1 gap-2">
            <Text className="text-lg font-semibold text-typography-900">
              {formattedDate}
            </Text>

            <HStack className="gap-4">
              {/* Beer count */}
              <HStack className="items-center gap-1.5">
                <Beer size={18} color={IconColors.default} />
                <Text className="text-sm text-typography-600">
                  {attendance.beerCount} {attendance.beerCount === 1 ? "beer" : "beers"}
                </Text>
              </HStack>

              {/* Tent count */}
              {tentCount > 0 && (
                <HStack className="items-center gap-1.5">
                  <MapPin size={18} color={IconColors.muted} />
                  <Text className="text-sm text-typography-500">
                    {tentCount} {tentCount === 1 ? "tent" : "tents"}
                  </Text>
                </HStack>
              )}

              {/* Photo count */}
              {photoCount > 0 && (
                <HStack className="items-center gap-1.5">
                  <Camera size={18} color={IconColors.muted} />
                  <Text className="text-sm text-typography-500">
                    {photoCount}
                  </Text>
                </HStack>
              )}
            </HStack>
          </VStack>

          {/* Right side: Photo thumbnails */}
          {photos.length > 0 && (
            <HStack className="gap-1">
              {photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.pictureUrl }}
                  className="h-12 w-12 rounded"
                  resizeMode="cover"
                />
              ))}
            </HStack>
          )}
        </HStack>
      </Card>
    </Pressable>
  );
}

AttendanceCard.displayName = "AttendanceCard";
