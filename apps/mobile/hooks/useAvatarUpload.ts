/**
 * Hook for handling avatar upload in the mobile app
 *
 * Thin wrapper around useImageUpload that handles the avatar-specific
 * upload flow (signed URL, storage upload, confirmation).
 */

import { apiClient } from "@/lib/api-client";
import { useInvalidateQueries } from "@prostcounter/shared/data";
import { QueryKeys } from "@prostcounter/shared/data";

import { useImageUpload, type ImageSource } from "./useImageUpload";

interface UseAvatarUploadOptions {
  onSuccess?: (fileName: string) => void;
  onError?: (error: Error) => void;
}

interface UseAvatarUploadReturn {
  pickImage: (source: ImageSource) => Promise<void>;
  isUploading: boolean;
  error: Error | null;
}

export type { ImageSource };

export function useAvatarUpload({
  onSuccess,
  onError,
}: UseAvatarUploadOptions = {}): UseAvatarUploadReturn {
  const invalidateQueries = useInvalidateQueries();
  const { pickImages, isUploading, setIsUploading, error, showError } =
    useImageUpload({
      onError,
      compress: {
        maxSize: 800,
        quality: 0.8,
      },
      errorMessageKey: "imageUpload.errors.avatarUploadFailed",
    });

  async function pickImage(source: ImageSource) {
    const images = await pickImages(source);
    if (!images?.length) {
      return;
    }

    const image = images[0];

    try {
      setIsUploading(true);

      // Step 1: Get signed upload URL
      const { uploadUrl, fileName } =
        await apiClient.profile.getAvatarUploadUrl({
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

      // Step 3: Confirm upload with just the filename
      await apiClient.profile.confirmAvatarUpload(fileName);

      // Invalidate profile query to refetch updated avatar
      invalidateQueries(QueryKeys.profile());

      onSuccess?.(fileName);
    } catch (err) {
      const uploadError =
        err instanceof Error ? err : new Error("Upload failed");
      showError(uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  return {
    pickImage,
    isUploading,
    error,
  };
}
