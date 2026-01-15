/**
 * Generic hook for handling image upload in the mobile app
 *
 * Uses expo-image-picker for image selection, expo-image-manipulator for
 * compression. Provides reusable image picking and compression logic.
 */

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

export type ImageSource = "camera" | "library";

export interface CompressOptions {
  /** Max width/height for the image */
  maxSize?: number;
  /** Compression quality (0-1) */
  quality?: number;
  /** Output format */
  format?: SaveFormat;
}

export interface PickedImage {
  uri: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  originalFileName: string;
}

export interface UseImageUploadOptions {
  /** Called when image picking/processing fails */
  onError?: (error: Error) => void;
  /** Compression options */
  compress?: CompressOptions;
  /** Allow multiple image selection (only for library) */
  allowMultiple?: boolean;
  /** Translation key for error message (defaults to "imageUpload.errors.uploadFailed") */
  errorMessageKey?: string;
}

/** Raw picked image before compression */
export interface RawPickedImage {
  uri: string;
  originalFileName: string;
}

export interface UseImageUploadReturn {
  /** Pick and process image(s) from camera or library (includes compression) */
  pickImages: (source: ImageSource) => Promise<PickedImage[] | null>;
  /** Pick image(s) without compression - for instant preview */
  pickImagesRaw: (source: ImageSource) => Promise<RawPickedImage[] | null>;
  /** Compress a raw image for upload */
  compressImage: (uri: string) => Promise<PickedImage>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Set uploading state (for custom upload flows) */
  setIsUploading: (value: boolean) => void;
  /** Last error that occurred */
  error: Error | null;
  /** Set error state */
  setError: (error: Error | null) => void;
  /** Show error alert with translation */
  showError: (error: Error) => void;
}

const DEFAULT_COMPRESS_OPTIONS: Required<CompressOptions> = {
  maxSize: 800,
  quality: 0.8,
  format: SaveFormat.WEBP,
};

/**
 * Generic hook for image upload operations
 *
 * Handles permission requests, image picking, and compression.
 * The actual upload logic is left to the consumer for flexibility.
 */
export function useImageUpload({
  onError,
  compress = {},
  allowMultiple = false,
  errorMessageKey = "imageUpload.errors.uploadFailed",
}: UseImageUploadOptions = {}): UseImageUploadReturn {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const compressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...compress };

  function showError(err: Error) {
    setError(err);
    onError?.(err);
    Alert.alert(t("common.errors.title"), t(errorMessageKey));
  }

  /**
   * Pick and compress images (original behavior)
   */
  async function pickImages(
    source: ImageSource,
  ): Promise<PickedImage[] | null> {
    try {
      setError(null);

      // Request permissions
      const hasPermission = await requestPermission(source, t);
      if (!hasPermission) {
        return null;
      }

      // Launch picker
      const result = await launchPicker(
        source,
        allowMultiple && source === "library",
      );
      if (result.canceled || !result.assets?.length) {
        return null;
      }

      // Process all selected images
      const processedImages = await Promise.all(
        result.assets.map((asset) => processImage(asset.uri, compressOptions)),
      );

      return processedImages;
    } catch (err) {
      const uploadError =
        err instanceof Error ? err : new Error("Image selection failed");
      showError(uploadError);
      return null;
    }
  }

  /**
   * Pick images without compression - for instant preview
   * Returns raw URIs that can be compressed later with compressImage()
   */
  async function pickImagesRaw(
    source: ImageSource,
  ): Promise<RawPickedImage[] | null> {
    try {
      setError(null);

      // Request permissions
      const hasPermission = await requestPermission(source, t);
      if (!hasPermission) {
        return null;
      }

      // Launch picker
      const result = await launchPicker(
        source,
        allowMultiple && source === "library",
      );
      if (result.canceled || !result.assets?.length) {
        return null;
      }

      // Return raw images without processing
      return result.assets.map((asset) => ({
        uri: asset.uri,
        originalFileName: asset.uri.split("/").pop() || "image.jpg",
      }));
    } catch (err) {
      const uploadError =
        err instanceof Error ? err : new Error("Image selection failed");
      showError(uploadError);
      return null;
    }
  }

  /**
   * Compress a single image for upload
   * Call this when ready to upload (e.g., on form save)
   */
  async function compressForUpload(uri: string): Promise<PickedImage> {
    return processImage(uri, compressOptions);
  }

  return {
    pickImages,
    pickImagesRaw,
    compressImage: compressForUpload,
    isUploading,
    setIsUploading,
    error,
    setError,
    showError,
  };
}

/**
 * Request camera or media library permission
 */
async function requestPermission(
  source: ImageSource,
  t: ReturnType<typeof useTranslation>["t"],
): Promise<boolean> {
  const { status } =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    const messageKey =
      source === "camera"
        ? "imageUpload.permissions.cameraRequired"
        : "imageUpload.permissions.libraryRequired";

    Alert.alert(t("common.errors.title"), t(messageKey));
    return false;
  }

  return true;
}

/**
 * Launch camera or image library picker
 */
async function launchPicker(
  source: ImageSource,
  allowMultiple: boolean,
): Promise<ImagePicker.ImagePickerResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"] as ImagePicker.MediaType[],
    allowsEditing: !allowMultiple, // Can't edit when selecting multiple
    aspect: [1, 1],
    quality: 1, // We'll compress ourselves
    allowsMultipleSelection: allowMultiple,
  };

  return source === "camera"
    ? ImagePicker.launchCameraAsync(options)
    : ImagePicker.launchImageLibraryAsync(options);
}

/**
 * Process a single image: compress and convert to ArrayBuffer
 */
async function processImage(
  uri: string,
  options: Required<CompressOptions>,
): Promise<PickedImage> {
  // Compress image
  const compressedUri = await compressImage(uri, options);

  // Convert to ArrayBuffer for upload
  const arrayBuffer = await uriToArrayBuffer(compressedUri);

  // Get original filename
  const originalFileName = uri.split("/").pop() || "image.jpg";

  // Determine mime type based on format
  const mimeType = getMimeType(options.format);

  return {
    uri: compressedUri,
    arrayBuffer,
    mimeType,
    originalFileName,
  };
}

/**
 * Compress and convert image to specified format
 */
async function compressImage(
  uri: string,
  options: Required<CompressOptions>,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: options.maxSize, height: options.maxSize });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    format: options.format,
    compress: options.quality,
  });

  return result.uri;
}

/**
 * Convert a local file URI to an ArrayBuffer for upload
 * @see https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
 */
async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/**
 * Get MIME type for SaveFormat
 */
function getMimeType(format: SaveFormat): string {
  switch (format) {
    case SaveFormat.WEBP:
      return "image/webp";
    case SaveFormat.PNG:
      return "image/png";
    case SaveFormat.JPEG:
    default:
      return "image/jpeg";
  }
}
