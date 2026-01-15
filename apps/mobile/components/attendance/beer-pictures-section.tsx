import {
  ImageSourcePicker,
  type ImageSource,
} from "@/components/image-source-picker";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  useBeerPictureUpload,
  type PendingPhoto,
} from "@/hooks/useBeerPictureUpload";
import { IconColors } from "@/lib/constants/colors";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ImagePlus, Minus, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";

interface BeerPicture {
  id: string;
  pictureUrl: string;
}

interface BeerPicturesSectionProps {
  /** Already uploaded photos */
  existingPhotos: BeerPicture[];
  /** Photos pending upload (local previews) */
  pendingPhotos: PendingPhoto[];
  /** IDs of existing photos marked for removal (deleted on Save) */
  photosMarkedForRemoval: string[];
  /** Called when pending photos change */
  onPendingPhotosChange: (photos: PendingPhoto[]) => void;
  /** Called when an existing photo is marked/unmarked for removal */
  onTogglePhotoRemoval: (photoId: string) => void;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Whether photos are currently uploading */
  isUploading?: boolean;
}

/**
 * Beer pictures section for attendance form
 *
 * Features:
 * - Photo grid with add button
 * - Camera or gallery picker (supports multi-select)
 * - Local preview for pending photos
 * - Photo deletion
 * - Photos are NOT uploaded until form is saved
 */
export function BeerPicturesSection({
  existingPhotos,
  pendingPhotos,
  photosMarkedForRemoval,
  onPendingPhotosChange,
  onTogglePhotoRemoval,
  disabled = false,
  isUploading = false,
}: BeerPicturesSectionProps) {
  const { t } = useTranslation();
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImagePreview = useCallback((imageUri: string) => {
    setPreviewImage(imageUri);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const { pickImages, isPicking, error } = useBeerPictureUpload({
    onError: (err) => {
      console.error("Photo selection failed:", err);
    },
  });

  const handleAddPress = useCallback(() => {
    if (!disabled && !isUploading && !isPicking) {
      setShowSourcePicker(true);
    }
  }, [disabled, isUploading, isPicking]);

  const handleSourceSelect = useCallback(
    async (source: ImageSource) => {
      const newPhotos = await pickImages(source);
      if (newPhotos?.length) {
        onPendingPhotosChange([...pendingPhotos, ...newPhotos]);
      }
    },
    [pickImages, pendingPhotos, onPendingPhotosChange],
  );

  const handleRemovePendingPhoto = useCallback(
    (photoId: string) => {
      onPendingPhotosChange(pendingPhotos.filter((p) => p.id !== photoId));
    },
    [pendingPhotos, onPendingPhotosChange],
  );

  return (
    <VStack className="gap-2">
      <Text className="text-sm font-medium text-typography-700">
        {t("attendance.form.photos")}
      </Text>

      {/* Photo Grid */}
      <HStack className="flex-wrap gap-2">
        {/* Existing (uploaded) photos - red X badge, toggle mark for removal */}
        {existingPhotos.map((photo, index) => {
          const isMarkedForRemoval = photosMarkedForRemoval.includes(photo.id);
          return (
            <View key={photo.id || `photo-${index}`} className="relative">
              <Pressable onPress={() => handleImagePreview(photo.pictureUrl)}>
                <Image
                  source={{ uri: photo.pictureUrl }}
                  className={`h-20 w-20 rounded-lg ${isMarkedForRemoval ? "opacity-40" : ""}`}
                  resizeMode="cover"
                />
                {isMarkedForRemoval && (
                  <View className="absolute inset-0 items-center justify-center">
                    <X size={32} color={IconColors.error} />
                  </View>
                )}
              </Pressable>
              {!disabled && !isUploading && (
                <Pressable
                  onPress={() => onTogglePhotoRemoval(photo.id)}
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-error-500"
                >
                  <X size={14} color={IconColors.white} />
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Pending photos (local previews - not yet uploaded) - gray minus badge */}
        {pendingPhotos.map((photo) => (
          <View key={photo.id} className="relative">
            <Pressable onPress={() => handleImagePreview(photo.localUri)}>
              <Image
                source={{ uri: photo.localUri }}
                className={`h-20 w-20 rounded-lg ${isUploading ? "opacity-60" : ""}`}
                resizeMode="cover"
              />
            </Pressable>
            {isUploading ? (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator size="small" color={IconColors.white} />
              </View>
            ) : (
              !disabled && (
                <Pressable
                  onPress={() => handleRemovePendingPhoto(photo.id)}
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-background-400"
                >
                  <Minus size={14} color={IconColors.white} />
                </Pressable>
              )
            )}
          </View>
        ))}

        {/* Loading skeleton while picking/processing images */}
        {isPicking && (
          <View className="h-20 w-20 items-center justify-center rounded-lg bg-background-200">
            <ActivityIndicator size="small" color={IconColors.muted} />
          </View>
        )}

        {/* Add button */}
        {!disabled && (
          <Pressable
            onPress={handleAddPress}
            disabled={isUploading || isPicking}
            className="h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-background-300 bg-background-50"
          >
            <ImagePlus size={24} color={IconColors.muted} />
          </Pressable>
        )}
      </HStack>

      {/* Error message */}
      {error && <Text className="text-sm text-error-600">{error.message}</Text>}

      {/* Source picker */}
      <ImageSourcePicker
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        onSelect={handleSourceSelect}
        disabled={isUploading || isPicking}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUri={previewImage} onClose={handleClosePreview} />
    </VStack>
  );
}

BeerPicturesSection.displayName = "BeerPicturesSection";
