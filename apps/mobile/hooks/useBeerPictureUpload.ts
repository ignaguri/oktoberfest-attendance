/**
 * Hook for handling beer picture uploads in the mobile app
 *
 * Thin wrapper around useImageUpload that handles uploading beer photos
 * to the beer_pictures bucket. Supports multiple image selection.
 *
 * NOTE: This is a draft implementation. The API endpoints and flow
 * may need adjustment once the beer picture upload API is finalized.
 *
 * TODO: Implement the following API endpoints in packages/api:
 * - apiClient.photos.getUploadUrl({ attendanceId, fileName, fileType, fileSize })
 * - apiClient.photos.confirmUpload(fileName)
 */

import { useImageUpload, type ImageSource } from "./useImageUpload";

interface UseBeerPictureUploadOptions {
  /** The attendance record to attach photos to */
  attendanceId: string;
  /** Called when all uploads succeed */
  onSuccess?: (fileNames: string[]) => void;
  /** Called when any upload fails */
  onError?: (error: Error) => void;
}

interface UseBeerPictureUploadReturn {
  pickImages: (source: ImageSource) => Promise<void>;
  isUploading: boolean;
  error: Error | null;
}

export type { ImageSource };

export function useBeerPictureUpload({
  attendanceId,
  onSuccess,
  onError,
}: UseBeerPictureUploadOptions): UseBeerPictureUploadReturn {
  const {
    pickImages: pickAndProcessImages,
    isUploading,
    setIsUploading,
    error,
    showError,
  } = useImageUpload({
    onError,
    allowMultiple: true,
    compress: {
      maxSize: 1200, // Larger than avatars for better photo quality
      quality: 0.85,
    },
    errorMessageKey: "imageUpload.errors.photoUploadFailed",
  });

  async function pickImages(source: ImageSource) {
    const images = await pickAndProcessImages(source);
    if (!images?.length) {
      return;
    }

    try {
      setIsUploading(true);

      const uploadedFileNames: string[] = [];

      // Upload each image
      for (const image of images) {
        // TODO: Replace with actual API call once endpoint is implemented
        // const { uploadUrl, fileName } = await apiClient.photos.getUploadUrl({
        //   attendanceId,
        //   fileName: image.originalFileName,
        //   fileType: image.mimeType,
        //   fileSize: image.arrayBuffer.byteLength,
        // });

        // Placeholder - remove once API is implemented
        const uploadUrl = "";
        const fileName = image.originalFileName;
        void attendanceId; // Suppress unused variable warning

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

        // TODO: Replace with actual API call once endpoint is implemented
        // await apiClient.photos.confirmUpload(fileName);

        uploadedFileNames.push(fileName);
      }

      onSuccess?.(uploadedFileNames);
    } catch (err) {
      const uploadError =
        err instanceof Error ? err : new Error("Upload failed");
      showError(uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  return {
    pickImages,
    isUploading,
    error,
  };
}
