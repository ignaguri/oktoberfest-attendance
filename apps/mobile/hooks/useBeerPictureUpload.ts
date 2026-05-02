/**
 * Hook for picking beer pictures.
 *
 * Returns picked URIs as PendingPhoto entries for immediate preview. Actual
 * persistence + compression + upload runs through the offline sync queue
 * (see savePendingPhotos in lib/database/photo-queue and the UPLOAD_FILE
 * handler in lib/database/sync/sync-manager). The queue ensures photo
 * uploads only fire after their parent attendance has been pushed, which
 * is what prevents 403 "Attendance not found" on /photos/upload-url.
 */

import { useCallback, useState } from "react";

import { type ImageSource, useImageUpload } from "./useImageUpload";

/**
 * Pending photo ready for preview
 * Stores original URI - compression happens at upload time inside the queue
 */
interface PendingPhoto {
  id: string;
  localUri: string;
}

interface UseBeerPictureUploadOptions {
  /** Called when picking fails */
  onError?: (error: Error) => void;
}

interface UseBeerPictureUploadReturn {
  /** Pick images from camera or library - returns pending photos for preview */
  pickImages: (source: ImageSource) => Promise<PendingPhoto[] | null>;
  /** Whether images are being picked/processed from gallery */
  isPicking: boolean;
  /** Last error that occurred */
  error: Error | null;
}

export type { ImageSource, PendingPhoto };

export function useBeerPictureUpload({
  onError,
}: UseBeerPictureUploadOptions = {}): UseBeerPictureUploadReturn {
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { pickImagesRaw } = useImageUpload({
    onError,
    allowMultiple: true,
    allowEditing: false, // Keep original aspect ratio for beer pictures
    errorMessageKey: "imageUpload.errors.photoUploadFailed",
  });

  const pickImages = useCallback(
    async (source: ImageSource): Promise<PendingPhoto[] | null> => {
      try {
        setError(null);
        setIsPicking(true);
        const images = await pickImagesRaw(source);

        if (!images?.length) {
          return null;
        }

        const pendingPhotos: PendingPhoto[] = images.map((img, index) => ({
          id: `pending-${Date.now()}-${index}`,
          localUri: img.uri,
        }));

        return pendingPhotos;
      } catch (err) {
        const pickError = err instanceof Error ? err : new Error("Failed to pick images");
        setError(pickError);
        onError?.(pickError);
        return null;
      } finally {
        setIsPicking(false);
      }
    },
    [pickImagesRaw, onError],
  );

  return {
    pickImages,
    isPicking,
    error,
  };
}
