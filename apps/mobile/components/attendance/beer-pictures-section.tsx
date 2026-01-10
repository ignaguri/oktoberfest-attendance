import { useCallback, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Camera, ImagePlus, Trash2, X } from "lucide-react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import {
  useBeerPictureUpload,
  type ImageSource,
} from "@/hooks/useBeerPictureUpload";

interface BeerPicture {
  id: string;
  pictureUrl: string;
}

interface BeerPicturesSectionProps {
  attendanceId?: string;
  existingPhotos: BeerPicture[];
  onPhotosChange: (photos: BeerPicture[]) => void;
  onPhotoRemove?: (photoId: string) => void;
  disabled?: boolean;
}

/**
 * Beer pictures section for attendance form
 *
 * Features:
 * - Photo grid with add button
 * - Camera or gallery picker
 * - Loading state during upload
 * - Photo deletion
 *
 * NOTE: Photo upload is currently disabled as the API endpoint is not yet implemented.
 * Existing photos from the database will still be displayed.
 */
export function BeerPicturesSection({
  attendanceId,
  existingPhotos,
  onPhotosChange,
  onPhotoRemove,
  disabled = false,
}: BeerPicturesSectionProps) {
  // Photo upload is currently disabled - API not implemented yet
  const isUploadEnabled = false;
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const { pickImages, isUploading, error } = useBeerPictureUpload({
    attendanceId: attendanceId ?? "",
    onSuccess: (fileNames) => {
      // For now, create mock photos - replace with actual URLs when API is ready
      const newPhotos = fileNames.map((fileName, index) => ({
        id: `temp-${Date.now()}-${index}`,
        pictureUrl: `file://${fileName}`, // Placeholder
      }));
      onPhotosChange([...existingPhotos, ...newPhotos]);
    },
    onError: (err) => {
      console.error("Photo upload failed:", err);
    },
  });

  const handleAddPress = useCallback(() => {
    if (!disabled && !isUploading && isUploadEnabled) {
      setShowSourcePicker(true);
    }
  }, [disabled, isUploading, isUploadEnabled]);

  const handleSourceSelect = useCallback(
    async (source: ImageSource) => {
      setShowSourcePicker(false);
      await pickImages(source);
    },
    [pickImages]
  );

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      if (onPhotoRemove) {
        onPhotoRemove(photoId);
      } else {
        onPhotosChange(existingPhotos.filter((p) => p.id !== photoId));
      }
    },
    [existingPhotos, onPhotosChange, onPhotoRemove]
  );

  return (
    <VStack className="gap-2">
      <Text className="text-sm font-medium text-typography-700">Photos</Text>

      {/* Photo Grid */}
      <HStack className="flex-wrap gap-2">
        {/* Existing photos */}
        {existingPhotos.map((photo) => (
          <View key={photo.id} className="relative">
            <Image
              source={{ uri: photo.pictureUrl }}
              className="h-20 w-20 rounded-lg"
              resizeMode="cover"
            />
            {!disabled && (
              <Pressable
                onPress={() => handleRemovePhoto(photo.id)}
                className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-error-500"
              >
                <X size={14} color={IconColors.white} />
              </Pressable>
            )}
          </View>
        ))}

        {/* Add button - disabled until API is implemented */}
        {!disabled && isUploadEnabled && (
          <Pressable
            onPress={handleAddPress}
            disabled={isUploading}
            className="h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-background-300 bg-background-50"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={IconColors.muted} />
            ) : (
              <ImagePlus size={24} color={IconColors.muted} />
            )}
          </Pressable>
        )}

        {/* Coming soon placeholder */}
        {!disabled && !isUploadEnabled && existingPhotos.length === 0 && (
          <View className="h-20 flex-1 items-center justify-center rounded-lg border border-dashed border-background-300 bg-background-50">
            <Text className="text-xs text-typography-400">Coming soon</Text>
          </View>
        )}
      </HStack>

      {/* Error message */}
      {error && (
        <Text className="text-sm text-error-600">{error.message}</Text>
      )}

      {/* Note about upload */}
      {!attendanceId && existingPhotos.length > 0 && (
        <Text className="text-xs text-typography-400">
          Photos will be uploaded after saving
        </Text>
      )}

      {/* Source picker actionsheet */}
      <Actionsheet
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetItem onPress={() => handleSourceSelect("camera")}>
            <Camera size={20} color={IconColors.default} />
            <ActionsheetItemText>Take Photo</ActionsheetItemText>
          </ActionsheetItem>

          <ActionsheetItem onPress={() => handleSourceSelect("library")}>
            <ImagePlus size={20} color={IconColors.default} />
            <ActionsheetItemText>Choose from Library</ActionsheetItemText>
          </ActionsheetItem>

          <ActionsheetItem onPress={() => setShowSourcePicker(false)}>
            <X size={20} color={IconColors.muted} />
            <ActionsheetItemText>Cancel</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}

BeerPicturesSection.displayName = "BeerPicturesSection";
