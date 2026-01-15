/**
 * Hook for handling beer picture uploads in the mobile app
 *
 * Provides separate methods for:
 * 1. Picking images (for instant preview - no compression)
 * 2. Uploading images (compression happens here, when form is saved)
 *
 * Flow:
 * 1. User picks images → stored locally with original URIs for instant preview
 * 2. User clicks Save → images are compressed and uploaded
 * 3. API: Get signed upload URL → Upload to storage → Confirm upload
 */

import { apiClient } from "@/lib/api-client";
import { useCallback, useState } from "react";

import { useImageUpload, type ImageSource } from "./useImageUpload";

interface UploadedPhoto {
  id: string;
  pictureUrl: string;
}

/**
 * Pending photo ready for preview
 * Stores original URI - compression happens at upload time
 */
interface PendingPhoto {
  id: string;
  localUri: string;
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
  /** Whether images are being picked/processed from gallery */
  isPicking: boolean;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Last error that occurred */
  error: Error | null;
}

export type { ImageSource, PendingPhoto, UploadedPhoto };

export function useBeerPictureUpload({
  onError,
}: UseBeerPictureUploadOptions = {}): UseBeerPictureUploadReturn {
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { pickImagesRaw, compressImage, showError } = useImageUpload({
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
   * Returns pending photos with original URIs for instant preview
   * Does NOT compress or upload - compression happens in uploadPendingPhotos
   */
  const pickImages = useCallback(
    async (source: ImageSource): Promise<PendingPhoto[] | null> => {
      try {
        setError(null);
        setIsPicking(true);
        const images = await pickImagesRaw(source);

        if (!images?.length) {
          return null;
        }

        // Create pending photos with original URIs for instant preview
        const pendingPhotos: PendingPhoto[] = images.map((img, index) => ({
          id: `pending-${Date.now()}-${index}`,
          localUri: img.uri,
        }));

        return pendingPhotos;
      } catch (err) {
        const pickError =
          err instanceof Error ? err : new Error("Failed to pick images");
        setError(pickError);
        onError?.(pickError);
        return null;
      } finally {
        setIsPicking(false);
      }
    },
    [pickImagesRaw, onError],
  );

  /**
   * Upload pending photos to storage
   * Compresses images at upload time (not when picking)
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

        // Compress and upload each image sequentially
        for (const pending of pendingPhotos) {
          // Step 1: Compress image (deferred from pick time)
          const compressedImage = await compressImage(pending.localUri);

          // Step 2: Get signed upload URL from API
          const { uploadUrl, pictureId } = await apiClient.photos.getUploadUrl({
            festivalId,
            attendanceId,
            fileName: compressedImage.originalFileName,
            fileType: compressedImage.mimeType,
            fileSize: compressedImage.arrayBuffer.byteLength,
          });

          // Step 3: Upload compressed image directly to storage
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": compressedImage.mimeType,
            },
            body: compressedImage.arrayBuffer,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload image to storage");
          }

          // Step 4: Confirm upload with API
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
    [compressImage, showError],
  );

  return {
    pickImages,
    uploadPendingPhotos,
    isPicking,
    isUploading,
    error,
  };
}
