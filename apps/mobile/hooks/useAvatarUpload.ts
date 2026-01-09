/**
 * Hook for handling avatar upload in the mobile app
 *
 * Uses expo-image-picker for image selection, expo-image-manipulator for
 * compression, and the API client for the two-step upload flow.
 */

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { apiClient } from "@/lib/api-client";

export type ImageSource = "camera" | "library";

interface UseAvatarUploadOptions {
  onSuccess?: (fileName: string) => void;
  onError?: (error: Error) => void;
}

interface UseAvatarUploadReturn {
  pickImage: (source: ImageSource) => Promise<void>;
  isUploading: boolean;
  error: Error | null;
}

/**
 * Compress and convert image to WebP format
 * Matches web behavior: 800x800 max size, 80% quality
 * Uses the new context-based ImageManipulator API
 */
async function compressImage(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 800, height: 800 });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.WEBP,
    compress: 0.8,
  });

  return result.uri;
}

/**
 * Convert a local file URI to an ArrayBuffer for upload
 * This is the recommended approach from Supabase's React Native documentation
 * @see https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
 */
async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

export function useAvatarUpload(
  options: UseAvatarUploadOptions = {},
): UseAvatarUploadReturn {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pickImage = useCallback(
    async (source: ImageSource) => {
      try {
        setError(null);

        // Request permissions
        if (source === "camera") {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              t("common.status.error"),
              t("profile.avatar.permissionDenied", {
                defaultValue: "Camera permission is required to take photos",
              }),
            );
            return;
          }
        } else {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              t("common.status.error"),
              t("profile.avatar.permissionDenied", {
                defaultValue:
                  "Photo library permission is required to select photos",
              }),
            );
            return;
          }
        }

        // Launch picker
        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"] as ImagePicker.MediaType[],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 1, // We'll compress ourselves
        };

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled || !result.assets?.[0]) {
          return;
        }

        const asset = result.assets[0];

        // Start upload
        setIsUploading(true);

        // Compress image (resize to 800x800, convert to WebP, 80% quality)
        const compressedUri = await compressImage(asset.uri);

        // Convert compressed image to ArrayBuffer for upload
        // This is the recommended approach from Supabase's React Native docs
        const arrayBuffer = await uriToArrayBuffer(compressedUri);

        // Get file info for the original (for size estimate)
        const originalFileName = asset.uri.split("/").pop() || "avatar.jpg";

        // Step 1: Get signed upload URL
        const { uploadUrl, fileName } =
          await apiClient.profile.getAvatarUploadUrl({
            fileName: originalFileName,
            fileType: "image/webp",
            fileSize: arrayBuffer.byteLength,
          });

        // Step 2: Upload compressed image directly to storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "image/webp",
          },
          body: arrayBuffer,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image to storage");
        }

        // Step 3: Confirm upload with just the filename
        await apiClient.profile.confirmAvatarUpload(fileName);

        setIsUploading(false);
        options.onSuccess?.(fileName);
      } catch (err) {
        const uploadError =
          err instanceof Error ? err : new Error("Upload failed");
        setError(uploadError);
        setIsUploading(false);
        options.onError?.(uploadError);

        Alert.alert(
          t("common.status.error"),
          t("profile.avatar.uploadError", {
            defaultValue: "Failed to update profile picture",
          }),
        );
      }
    },
    [t, options],
  );

  return {
    pickImage,
    isUploading,
    error,
  };
}
