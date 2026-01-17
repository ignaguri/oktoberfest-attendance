/**
 * Photo Upload Queue
 *
 * Handles large photo uploads when offline:
 * - Stores pending photos in FileSystem (not SQLite)
 * - Tracks references in beer_pictures table
 * - Queues upload operations for background sync
 * - Cleans up local files after successful upload
 */

import {
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  documentDirectory,
} from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { LocalBeerPicture, PhotoVisibility } from "./schema";
import type * as SQLite from "expo-sqlite";

import { enqueueOperation } from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export interface PendingPhotoInput {
  /** Local URI from image picker */
  localUri: string;
  /** Attendance ID this photo belongs to */
  attendanceId: string;
  /** User ID */
  userId: string;
  /** Festival ID (for API calls) */
  festivalId: string;
  /** Photo visibility */
  visibility?: PhotoVisibility;
}

export interface SavedPendingPhoto {
  /** Generated photo ID */
  id: string;
  /** Permanent local path */
  localPath: string;
  /** Attendance ID */
  attendanceId: string;
  /** Whether it's pending upload */
  isPending: boolean;
}

export interface PhotoUploadResult {
  /** Photo ID */
  id: string;
  /** Remote picture URL (after upload) */
  pictureUrl: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface ProcessPendingPhotosResult {
  /** Number of photos processed */
  processed: number;
  /** Number of successful uploads */
  succeeded: number;
  /** Number of failed uploads */
  failed: number;
  /** Upload results for each photo */
  results: PhotoUploadResult[];
}

export interface CompressOptions {
  /** Max width/height for the image */
  maxSize?: number;
  /** Compression quality (0-1) */
  quality?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Directory for pending photo uploads */
const PENDING_UPLOADS_DIR = "pending-uploads";

/** Default compression options for photos */
const DEFAULT_COMPRESS_OPTIONS: Required<CompressOptions> = {
  maxSize: 1200,
  quality: 0.85,
};

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Get the pending uploads directory path
 */
export function getPendingUploadsDir(): string {
  return `${documentDirectory}${PENDING_UPLOADS_DIR}/`;
}

/**
 * Ensure the pending uploads directory exists
 */
export async function ensurePendingUploadsDir(): Promise<void> {
  const dirPath = getPendingUploadsDir();
  const dirInfo = await getInfoAsync(dirPath);

  if (!dirInfo.exists) {
    await makeDirectoryAsync(dirPath, { intermediates: true });
    console.log("[PhotoQueue] Created pending uploads directory:", dirPath);
  }
}

// =============================================================================
// Photo Storage
// =============================================================================

/**
 * Generate a unique photo ID
 */
function generatePhotoId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `photo-${timestamp}-${random}`;
}

/**
 * Get file extension from URI
 */
function getFileExtension(uri: string): string {
  const parts = uri.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
  // Normalize extension
  if (ext === "jpeg") return "jpg";
  return ext;
}

/**
 * Save a pending photo to permanent storage
 *
 * @param db - SQLite database instance
 * @param input - Photo input with local URI and metadata
 * @returns Saved pending photo with permanent path
 */
export async function savePendingPhoto(
  db: SQLite.SQLiteDatabase,
  input: PendingPhotoInput,
): Promise<SavedPendingPhoto> {
  await ensurePendingUploadsDir();

  const photoId = generatePhotoId();
  const ext = getFileExtension(input.localUri);
  const fileName = `${photoId}.${ext}`;
  const permanentPath = `${getPendingUploadsDir()}${fileName}`;

  // Copy photo to permanent location
  await copyAsync({
    from: input.localUri,
    to: permanentPath,
  });

  console.log("[PhotoQueue] Saved photo to:", permanentPath);

  const now = new Date().toISOString();

  // Create local record in beer_pictures
  await db.runAsync(
    `INSERT INTO beer_pictures (
      id, attendance_id, user_id, picture_url, visibility, created_at,
      _synced_at, _deleted, _dirty, _pending_upload, _local_uri
    ) VALUES (?, ?, ?, NULL, ?, ?, NULL, 0, 1, 1, ?)`,
    [
      photoId,
      input.attendanceId,
      input.userId,
      input.visibility || "public",
      now,
      permanentPath,
    ],
  );

  // Queue upload operation
  await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", photoId, {
    localUri: permanentPath,
    festivalId: input.festivalId,
    attendanceId: input.attendanceId,
    visibility: input.visibility || "public",
  });

  return {
    id: photoId,
    localPath: permanentPath,
    attendanceId: input.attendanceId,
    isPending: true,
  };
}

/**
 * Save multiple pending photos
 */
export async function savePendingPhotos(
  db: SQLite.SQLiteDatabase,
  inputs: PendingPhotoInput[],
): Promise<SavedPendingPhoto[]> {
  const results: SavedPendingPhoto[] = [];

  for (const input of inputs) {
    try {
      const result = await savePendingPhoto(db, input);
      results.push(result);
    } catch (error) {
      console.error("[PhotoQueue] Failed to save pending photo:", error);
      // Continue with other photos even if one fails
    }
  }

  return results;
}

// =============================================================================
// Photo Retrieval
// =============================================================================

/**
 * Get all pending photos for an attendance
 */
export async function getPendingPhotosForAttendance(
  db: SQLite.SQLiteDatabase,
  attendanceId: string,
): Promise<LocalBeerPicture[]> {
  return db.getAllAsync<LocalBeerPicture>(
    `SELECT * FROM beer_pictures
     WHERE attendance_id = ?
       AND _deleted = 0
       AND _pending_upload = 1`,
    [attendanceId],
  );
}

/**
 * Get all pending photos across all attendances
 */
export async function getAllPendingPhotos(
  db: SQLite.SQLiteDatabase,
): Promise<LocalBeerPicture[]> {
  return db.getAllAsync<LocalBeerPicture>(
    `SELECT * FROM beer_pictures
     WHERE _deleted = 0
       AND _pending_upload = 1
     ORDER BY created_at ASC`,
  );
}

/**
 * Get photo by ID
 */
export async function getPhotoById(
  db: SQLite.SQLiteDatabase,
  photoId: string,
): Promise<LocalBeerPicture | null> {
  return db.getFirstAsync<LocalBeerPicture>(
    "SELECT * FROM beer_pictures WHERE id = ? AND _deleted = 0",
    [photoId],
  );
}

/**
 * Get photos for attendance (includes both pending and uploaded)
 */
export async function getPhotosForAttendance(
  db: SQLite.SQLiteDatabase,
  attendanceId: string,
): Promise<LocalBeerPicture[]> {
  return db.getAllAsync<LocalBeerPicture>(
    `SELECT * FROM beer_pictures
     WHERE attendance_id = ? AND _deleted = 0
     ORDER BY created_at ASC`,
    [attendanceId],
  );
}

// =============================================================================
// Photo Compression
// =============================================================================

/**
 * Compress an image for upload
 */
export async function compressPhoto(
  localUri: string,
  options: CompressOptions = {},
): Promise<{ uri: string; arrayBuffer: ArrayBuffer; mimeType: string }> {
  const opts = { ...DEFAULT_COMPRESS_OPTIONS, ...options };

  // Compress image
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: opts.maxSize, height: opts.maxSize });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.WEBP,
    compress: opts.quality,
  });

  // Convert to ArrayBuffer for upload
  const response = await fetch(result.uri);
  const arrayBuffer = await response.arrayBuffer();

  return {
    uri: result.uri,
    arrayBuffer,
    mimeType: "image/webp",
  };
}

// =============================================================================
// Photo Upload
// =============================================================================

export interface UploadPhotoOptions {
  /** API client for making requests */
  apiClient: {
    photos: {
      getUploadUrl: (params: {
        festivalId: string;
        attendanceId: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }) => Promise<{ uploadUrl: string; pictureId: string }>;
      confirmUpload: (
        pictureId: string,
      ) => Promise<{ id: string; pictureUrl: string }>;
    };
  };
  /** Compression options */
  compress?: CompressOptions;
  /** Callback for progress updates */
  onProgress?: (photoId: string, progress: number) => void;
}

/**
 * Upload a single pending photo
 *
 * Flow:
 * 1. Compress the image
 * 2. Get signed upload URL from API
 * 3. Upload to storage
 * 4. Confirm upload with API
 * 5. Update local record
 * 6. Clean up local file
 */
export async function uploadPendingPhoto(
  db: SQLite.SQLiteDatabase,
  photo: LocalBeerPicture,
  festivalId: string,
  options: UploadPhotoOptions,
): Promise<PhotoUploadResult> {
  const { apiClient, compress, onProgress } = options;

  if (!photo._local_uri) {
    return {
      id: photo.id,
      pictureUrl: "",
      success: false,
      error: "No local URI for pending photo",
    };
  }

  try {
    onProgress?.(photo.id, 0.1);

    // 1. Compress image
    const compressed = await compressPhoto(photo._local_uri, compress);
    onProgress?.(photo.id, 0.3);

    // 2. Get signed upload URL
    const { uploadUrl, pictureId } = await apiClient.photos.getUploadUrl({
      festivalId,
      attendanceId: photo.attendance_id,
      fileName: `${photo.id}.webp`,
      fileType: compressed.mimeType,
      fileSize: compressed.arrayBuffer.byteLength,
    });
    onProgress?.(photo.id, 0.4);

    // 3. Upload to storage
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": compressed.mimeType,
      },
      body: compressed.arrayBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }
    onProgress?.(photo.id, 0.8);

    // 4. Confirm upload with API
    const confirmedPhoto = await apiClient.photos.confirmUpload(pictureId);
    onProgress?.(photo.id, 0.9);

    // 5. Update local record
    await db.runAsync(
      `UPDATE beer_pictures
       SET picture_url = ?,
           _pending_upload = 0,
           _local_uri = NULL,
           _dirty = 0,
           _synced_at = ?
       WHERE id = ?`,
      [confirmedPhoto.pictureUrl, new Date().toISOString(), photo.id],
    );

    // 6. Clean up local file
    await cleanupLocalPhoto(photo._local_uri);
    onProgress?.(photo.id, 1.0);

    console.log("[PhotoQueue] Successfully uploaded photo:", photo.id);

    return {
      id: photo.id,
      pictureUrl: confirmedPhoto.pictureUrl,
      success: true,
    };
  } catch (error) {
    console.error("[PhotoQueue] Failed to upload photo:", photo.id, error);

    return {
      id: photo.id,
      pictureUrl: "",
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Process all pending photo uploads
 */
export async function processPendingPhotoUploads(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
  options: UploadPhotoOptions,
): Promise<ProcessPendingPhotosResult> {
  const pendingPhotos = await getAllPendingPhotos(db);

  if (pendingPhotos.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  console.log(`[PhotoQueue] Processing ${pendingPhotos.length} pending photos`);

  const results: PhotoUploadResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const photo of pendingPhotos) {
    const result = await uploadPendingPhoto(db, photo, festivalId, options);
    results.push(result);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(
    `[PhotoQueue] Upload complete: ${succeeded} succeeded, ${failed} failed`,
  );

  return {
    processed: pendingPhotos.length,
    succeeded,
    failed,
    results,
  };
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up a local photo file
 */
export async function cleanupLocalPhoto(localUri: string): Promise<void> {
  try {
    const fileInfo = await getInfoAsync(localUri);
    if (fileInfo.exists) {
      await deleteAsync(localUri, { idempotent: true });
      console.log("[PhotoQueue] Cleaned up local file:", localUri);
    }
  } catch (error) {
    console.warn(
      "[PhotoQueue] Failed to clean up local file:",
      localUri,
      error,
    );
    // Don't throw - cleanup failure shouldn't block upload success
  }
}

/**
 * Clean up all orphaned local photos
 * (Photos that exist in FileSystem but not in database)
 */
export async function cleanupOrphanedPhotos(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const dirPath = getPendingUploadsDir();
  const dirInfo = await getInfoAsync(dirPath);

  if (!dirInfo.exists) {
    return 0;
  }

  const files = await readDirectoryAsync(dirPath);
  let cleaned = 0;

  for (const file of files) {
    const photoId = file.split(".")[0];
    const photo = await getPhotoById(db, photoId);

    // If photo doesn't exist in DB or is no longer pending, clean up
    if (!photo || photo._pending_upload === 0) {
      const filePath = `${dirPath}${file}`;
      await cleanupLocalPhoto(filePath);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[PhotoQueue] Cleaned up ${cleaned} orphaned photos`);
  }

  return cleaned;
}

/**
 * Delete a pending photo (remove from DB and FileSystem)
 */
export async function deletePendingPhoto(
  db: SQLite.SQLiteDatabase,
  photoId: string,
): Promise<void> {
  const photo = await getPhotoById(db, photoId);

  if (!photo) {
    return;
  }

  // Soft delete in database
  await db.runAsync(
    `UPDATE beer_pictures
     SET _deleted = 1, _dirty = 1
     WHERE id = ?`,
    [photoId],
  );

  // Clean up local file if exists
  if (photo._local_uri) {
    await cleanupLocalPhoto(photo._local_uri);
  }

  console.log("[PhotoQueue] Deleted pending photo:", photoId);
}

// =============================================================================
// Statistics
// =============================================================================

export interface PhotoQueueStats {
  /** Total photos in queue */
  total: number;
  /** Pending upload */
  pending: number;
  /** Already uploaded */
  uploaded: number;
  /** Total size of pending photos in bytes */
  pendingSizeBytes: number;
}

/**
 * Get photo queue statistics
 */
export async function getPhotoQueueStats(
  db: SQLite.SQLiteDatabase,
): Promise<PhotoQueueStats> {
  const totalResult = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM beer_pictures WHERE _deleted = 0",
  );

  const pendingResult = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM beer_pictures WHERE _deleted = 0 AND _pending_upload = 1",
  );

  const total = totalResult?.count || 0;
  const pending = pendingResult?.count || 0;

  // Calculate size of pending files
  let pendingSizeBytes = 0;
  const pendingPhotos = await getAllPendingPhotos(db);

  for (const photo of pendingPhotos) {
    if (photo._local_uri) {
      try {
        const fileInfo = await getInfoAsync(photo._local_uri);
        if (fileInfo.exists && "size" in fileInfo) {
          pendingSizeBytes += fileInfo.size as number;
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return {
    total,
    pending,
    uploaded: total - pending,
    pendingSizeBytes,
  };
}
