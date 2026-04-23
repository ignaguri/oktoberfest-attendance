/**
 * Hook for handling avatar upload in the mobile app
 *
 * Thin wrapper around useImageUpload that handles the avatar-specific
 * upload flow (signed URL, storage upload, confirmation).
 */

import { useInvalidateQueries } from "@prostcounter/shared/data";
import { QueryKeys } from "@prostcounter/shared/data";
import { replaceLocalhostInUrl, safeHost } from "@prostcounter/shared/utils";

import { apiClient } from "@/lib/api-client";
import { Sentry } from "@/lib/sentry";

import { type ImageSource, useImageUpload } from "./useImageUpload";

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
      // Fix URL for local dev: replace localhost with the mobile client's Supabase host
      const envSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
      const fixedUploadUrl = replaceLocalhostInUrl(uploadUrl, envSupabaseUrl);

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(fixedUploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": image.mimeType,
          },
          body: image.arrayBuffer,
        });
      } catch (networkErr) {
        Sentry.captureException(networkErr, {
          tags: { flow: "avatar-upload" },
          extra: {
            stage: "network",
            uploadHost: safeHost(fixedUploadUrl),
            envSupabaseHost: safeHost(envSupabaseUrl),
            mimeType: image.mimeType,
            fileSize: image.arrayBuffer.byteLength,
          },
        });
        throw networkErr;
      }

      if (!uploadResponse.ok) {
        const bodySnippet = await uploadResponse
          .text()
          .catch(() => "<no body>");
        Sentry.captureMessage("Storage PUT failed", {
          level: "error",
          tags: { flow: "avatar-upload" },
          extra: {
            stage: "http",
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            body: bodySnippet.slice(0, 500),
            uploadHost: safeHost(fixedUploadUrl),
            envSupabaseHost: safeHost(envSupabaseUrl),
            mimeType: image.mimeType,
            fileSize: image.arrayBuffer.byteLength,
          },
        });
        throw new Error(
          `Storage upload failed (${uploadResponse.status} on ${safeHost(fixedUploadUrl)})`,
        );
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
