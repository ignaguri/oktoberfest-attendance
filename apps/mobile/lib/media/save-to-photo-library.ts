import * as MediaLibrary from "expo-media-library";

import { logger } from "@/lib/logger";

/**
 * Save a fresh camera shot to the device photo library.
 * Best effort: a denied permission or a failed write must never block the upload flow.
 */
export async function saveToPhotoLibrary(uri: string): Promise<void> {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) {
      return;
    }
    await MediaLibrary.Asset.create(uri);
  } catch (err) {
    logger.warn("[ImageUpload] Failed to save photo to library", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
