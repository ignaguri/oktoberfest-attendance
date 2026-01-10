/**
 * Hook for handling beer picture uploads in the mobile app
 *
 * Provides separate methods for:
 * 1. Picking/compressing images (for preview)
 * 2. Uploading images (when form is saved)
 *
 * Flow:
 * 1. User picks images → stored locally with preview URIs
 * 2. User clicks Save → images are uploaded
 * 3. API: Get signed upload URL → Upload to storage → Confirm upload
 */

import { useCallback, useState } from "react";

import {
  useImageUpload,
  type ImageSource,
  type PickedImage,
} from "./useImageUpload";
import { apiClient } from "@/lib/api-client";

interface UploadedPhoto {
  id: string;
  pictureUrl: string;
}

interface PendingPhoto {
  id: string;
  localUri: string;
  imageData: PickedImage;
}

interface UseBeerPictureUploadOptions {
  /** Called when any upload fails */
  onError?: (error: Error) => void;
}

interface UseBeerPictureUploadReturn {
  /** Pick images from camera or library - returns pending photos for preview */
  pickImages: (source: ImageSource) => Promise<PendingPhoto[] | null>;
  /** Upload pending photos to storage - call this when form is saved */
  uploadPendingPhotos: (params: {
    festivalId: string;
    attendanceId: string;
    pendingPhotos: PendingPhoto[];
  }) => Promise<UploadedPhoto[]>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Last error that occurred */
  error: Error | null;
}

export type { ImageSource, PendingPhoto, UploadedPhoto };

export function useBeerPictureUpload({
  onError,
}: UseBeerPictureUploadOptions = {}): UseBeerPictureUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { pickImages: pickAndProcessImages, showError } = useImageUpload({
    onError,
    allowMultiple: true,
    compress: {
      maxSize: 1200, // Larger than avatars for better photo quality
      quality: 0.85,
    },
    errorMessageKey: "imageUpload.errors.photoUploadFailed",
  });

  /**
   * Pick images from camera or library
   * Returns pending photos with local URIs for preview
   * Does NOT upload - call uploadPendingPhotos when ready
   */
  const pickImages = useCallback(
    async (source: ImageSource): Promise<PendingPhoto[] | null> => {
      try {
        setError(null);
        const images = await pickAndProcessImages(source);

        if (!images?.length) {
          return null;
        }

        // Create pending photos with local URIs for preview
        const pendingPhotos: PendingPhoto[] = images.map((img, index) => ({
          id: `pending-${Date.now()}-${index}`,
          localUri: img.uri,
          imageData: img,
        }));

        return pendingPhotos;
      } catch (err) {
        const pickError =
          err instanceof Error ? err : new Error("Failed to pick images");
        setError(pickError);
        onError?.(pickError);
        return null;
      }
    },
    [pickAndProcessImages, onError],
  );

  /**
   * Upload pending photos to storage
   * Call this when the form is saved
   */
  const uploadPendingPhotos = useCallback(
    async ({
      festivalId,
      attendanceId,
      pendingPhotos,
    }: {
      festivalId: string;
      attendanceId: string;
      pendingPhotos: PendingPhoto[];
    }): Promise<UploadedPhoto[]> => {
      if (!festivalId || !attendanceId) {
        throw new Error("Missing festival or attendance ID");
      }

      if (!pendingPhotos.length) {
        return [];
      }

      setIsUploading(true);
      setError(null);

      try {
        const uploadedPhotos: UploadedPhoto[] = [];

        // Upload each image sequentially
        for (const pending of pendingPhotos) {
          const image = pending.imageData;

          // Step 1: Get signed upload URL from API
          const { uploadUrl, pictureId } = await apiClient.photos.getUploadUrl({
            festivalId,
            attendanceId,
            fileName: image.originalFileName,
            fileType: image.mimeType,
            fileSize: image.arrayBuffer.byteLength,
          });

          // Step 2: Upload compressed image directly to storage
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": image.mimeType,
            },
            body: image.arrayBuffer,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload image to storage");
          }

          // Step 3: Confirm upload with API
          const confirmedPhoto =
            await apiClient.photos.confirmUpload(pictureId);

          uploadedPhotos.push({
            id: confirmedPhoto.id,
            pictureUrl: confirmedPhoto.pictureUrl,
          });
        }

        return uploadedPhotos;
      } catch (err) {
        const uploadError =
          err instanceof Error ? err : new Error("Upload failed");
        setError(uploadError);
        showError(uploadError);
        throw uploadError;
      } finally {
        setIsUploading(false);
      }
    },
    [showError],
  );

  return {
    pickImages,
    uploadPendingPhotos,
    isUploading,
    error,
  };
}
