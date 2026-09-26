import { useTaggedPhotos } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { TaggedPhoto } from "@prostcounter/shared/schemas";
import { useState } from "react";
import { Image, ScrollView } from "react-native";

import { PhotoDetailModal } from "@/components/gallery/photo-detail-modal";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getBeerPictureUrl } from "@/lib/utils";

interface TaggedPhotosStripProps {
  userId: string | undefined;
  festivalId: string | undefined;
  title: string;
}

/** Photos someone is tagged in for the current festival. Renders nothing when empty. */
export function TaggedPhotosStrip({ userId, festivalId, title }: TaggedPhotosStripProps) {
  const { t } = useTranslation();
  const { data } = useTaggedPhotos(userId, festivalId);
  const [openPhoto, setOpenPhoto] = useState<TaggedPhoto | null>(null);

  const photos = data?.photos ?? [];
  if (photos.length === 0) {
    return null;
  }

  const openUrl = openPhoto ? (getBeerPictureUrl(openPhoto.pictureUrl) ?? null) : null;

  return (
    <VStack space="sm">
      <Text className="text-sm font-semibold text-typography-700">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack space="sm">
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setOpenPhoto(photo)}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityHint={t("photoTags.strip.openPhotoHint")}
            >
              <Image
                source={{ uri: getBeerPictureUrl(photo.pictureUrl) }}
                className="h-20 w-20 rounded-lg"
                resizeMode="cover"
                alt=""
              />
            </Pressable>
          ))}
        </HStack>
      </ScrollView>

      {openPhoto?.groupId ? (
        <PhotoDetailModal
          visible
          photoId={openPhoto.id}
          photoUrl={openUrl}
          groupId={openPhoto.groupId}
          onClose={() => setOpenPhoto(null)}
        />
      ) : (
        <ImagePreviewModal imageUri={openUrl} onClose={() => setOpenPhoto(null)} />
      )}
    </VStack>
  );
}
