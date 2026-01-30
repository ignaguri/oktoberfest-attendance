import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "@prostcounter/shared/constants";
import { useGroupGallery, useGroupName } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatLocalized } from "@prostcounter/shared/utils";
import { getInitials } from "@prostcounter/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { Camera, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl, getBeerPictureUrl } from "@/lib/utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const IMAGE_GAP = 4;
const IMAGE_SIZE =
  (SCREEN_WIDTH - 32 - IMAGE_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface GalleryPhoto {
  id: string;
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  pictureUrl: string;
  date: string;
  createdAt: string;
}

interface GroupedGallery {
  date: string;
  formattedDate: string;
  users: {
    userId: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    photos: GalleryPhoto[];
  }[];
}

/**
 * Transform flat gallery data to grouped by date and user
 */
function groupGalleryData(photos: GalleryPhoto[]): GroupedGallery[] {
  const grouped: Record<string, Record<string, GalleryPhoto[]>> = {};

  for (const photo of photos) {
    const dateKey = photo.date;
    const userKey = photo.userId;

    if (!grouped[dateKey]) {
      grouped[dateKey] = {};
    }
    if (!grouped[dateKey][userKey]) {
      grouped[dateKey][userKey] = [];
    }
    grouped[dateKey][userKey].push(photo);
  }

  // Convert to array and sort by date descending
  return Object.entries(grouped)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([date, users]) => ({
      date,
      formattedDate: formatLocalized(
        new TZDate(date, TIMEZONE),
        "EEEE, MMMM d",
      ),
      users: Object.entries(users).map(([userId, userPhotos]) => ({
        userId,
        username: userPhotos[0].username,
        fullName: userPhotos[0].fullName,
        avatarUrl: userPhotos[0].avatarUrl,
        photos: userPhotos,
      })),
    }));
}

export default function GroupGalleryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // Fetch gallery data
  const {
    data: galleryData,
    loading: isLoading,
    error,
    refetch,
    isRefetching,
  } = useGroupGallery(id || "");

  // Fetch group name for header
  const { data: groupName } = useGroupName(id || "");

  // Group photos by date and user
  const groupedGallery = useMemo(
    () => groupGalleryData((galleryData as GalleryPhoto[]) || []),
    [galleryData],
  );

  const hasPhotos = groupedGallery.length > 0;

  const handleImagePress = useCallback((imageUrl: string) => {
    setImageLoading(true);
    setSelectedImage(imageUrl);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedImage(null);
    setImageLoading(true);
  }, []);

  // Loading state
  if (isLoading && !galleryData) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Stack.Screen
          options={{
            title: t("groups.gallery.title"),
          }}
        />
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Stack.Screen
          options={{
            title: t("groups.gallery.title"),
          }}
        />
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: groupName
            ? t("groups.gallery.titleWithName", {
                groupName,
              })
            : t("groups.gallery.title"),
        }}
      />

      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching ?? false}
            onRefresh={refetch}
          />
        }
      >
        <VStack space="lg" className="p-4 pb-8">
          {/* Empty State */}
          {!hasPhotos && (
            <Card
              variant="outline"
              size="md"
              className="items-center bg-white p-8"
            >
              <Camera size={48} color={IconColors.disabled} />
              <Text className="mt-4 text-center text-lg font-medium text-typography-700">
                {t("groups.gallery.empty.title")}
              </Text>
              <Text className="mt-2 text-center text-sm text-typography-500">
                {t("groups.gallery.empty.description")}
              </Text>
            </Card>
          )}

          {/* Photo Grid by Date */}
          {groupedGallery.map((dayGroup) => (
            <VStack key={dayGroup.date} space="md">
              {/* Date Header */}
              <Text className="text-lg font-semibold text-typography-900">
                {dayGroup.formattedDate}
              </Text>

              {/* Users for this date */}
              {dayGroup.users.map((userGroup) => (
                <VStack key={userGroup.userId} space="sm">
                  {/* User Header */}
                  <HStack space="sm" className="items-center">
                    <Avatar size="xs">
                      {userGroup.avatarUrl ? (
                        <AvatarImage
                          source={{ uri: getAvatarUrl(userGroup.avatarUrl) }}
                          alt={userGroup.username}
                        />
                      ) : (
                        <AvatarFallbackText>
                          {getInitials({
                            fullName: userGroup.fullName,
                            username: userGroup.username,
                          })}
                        </AvatarFallbackText>
                      )}
                    </Avatar>
                    <Text className="text-sm font-medium text-typography-700">
                      {userGroup.username || userGroup.fullName || "Unknown"}
                    </Text>
                  </HStack>

                  {/* Photo Grid */}
                  <HStack className="flex-wrap" style={{ gap: IMAGE_GAP }}>
                    {userGroup.photos.map((photo) => {
                      const imageUrl = getBeerPictureUrl(photo.pictureUrl);

                      return (
                        <Pressable
                          key={photo.id}
                          onPress={() => imageUrl && handleImagePress(imageUrl)}
                          style={{
                            width: IMAGE_SIZE,
                            height: IMAGE_SIZE,
                            borderRadius: 8,
                            overflow: "hidden",
                            backgroundColor: "#f3f4f6",
                          }}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={{
                                width: "100%",
                                height: "100%",
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="h-full w-full items-center justify-center bg-gray-200">
                              <Camera size={24} color={IconColors.disabled} />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </HStack>
                </VStack>
              ))}
            </VStack>
          ))}
        </VStack>
      </ScrollView>

      {/* Full-size Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 bg-black">
          {/* Close Button */}
          <Pressable
            onPress={handleCloseModal}
            className="absolute right-4 top-12 z-10 rounded-full bg-black/50 p-2"
          >
            <X size={24} color="#FFFFFF" />
          </Pressable>

          {/* Image */}
          <Pressable
            onPress={handleCloseModal}
            className="flex-1 items-center justify-center"
          >
            {imageLoading && (
              <View className="absolute">
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{
                  width: SCREEN_WIDTH,
                  height: SCREEN_WIDTH,
                }}
                resizeMode="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
              />
            )}
          </Pressable>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}
