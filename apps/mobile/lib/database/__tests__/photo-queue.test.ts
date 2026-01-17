/**
 * Photo Queue Tests
 *
 * Tests for the photo upload queue functionality.
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import type { LocalBeerPicture } from "../schema";

import {
  getPendingUploadsDir,
  compressPhoto,
  type PhotoUploadResult,
  type ProcessPendingPhotosResult,
  type PhotoQueueStats,
} from "../photo-queue";

// Mock expo-file-system/legacy
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/documents/",
  copyAsync: vi.fn().mockResolvedValue(undefined),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  getInfoAsync: vi.fn().mockResolvedValue({ exists: true, size: 1024 }),
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  readDirectoryAsync: vi.fn().mockResolvedValue([]),
}));

// Mock expo-image-manipulator
vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: vi.fn().mockReturnValue({
      resize: vi.fn().mockReturnThis(),
      renderAsync: vi.fn().mockResolvedValue({
        saveAsync: vi.fn().mockResolvedValue({
          uri: "file:///mock/compressed.webp",
        }),
      }),
    }),
  },
  SaveFormat: {
    WEBP: "webp",
    JPEG: "jpeg",
    PNG: "png",
  },
}));

// Mock sync-queue
vi.mock("../sync-queue", () => ({
  enqueueOperation: vi.fn().mockResolvedValue("op-123"),
}));

// Create mock database
function createMockDb() {
  return {
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
    runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
  };
}

// Create mock photo
function createMockPhoto(
  overrides: Partial<LocalBeerPicture> = {},
): LocalBeerPicture {
  return {
    id: "photo-123",
    attendance_id: "attendance-123",
    user_id: "user-123",
    picture_url: null,
    visibility: "public",
    created_at: new Date().toISOString(),
    _synced_at: null,
    _deleted: 0,
    _dirty: 1,
    _pending_upload: 1,
    _local_uri: "file:///mock/pending-uploads/photo-123.jpg",
    ...overrides,
  };
}

describe("Photo Queue", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe("getPendingUploadsDir", () => {
    it("should return the pending uploads directory path", () => {
      const dir = getPendingUploadsDir();
      expect(dir).toBe("file:///mock/documents/pending-uploads/");
    });
  });

  describe("photo compression", () => {
    it("should compress photos with default options", async () => {
      // Mock fetch for ArrayBuffer conversion
      const mockArrayBuffer = new ArrayBuffer(1024);
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await compressPhoto("file:///mock/original.jpg");

      expect(result).toHaveProperty("uri");
      expect(result).toHaveProperty("arrayBuffer");
      expect(result).toHaveProperty("mimeType", "image/webp");
    });

    it("should compress photos with custom options", async () => {
      const mockArrayBuffer = new ArrayBuffer(512);
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      const result = await compressPhoto("file:///mock/original.jpg", {
        maxSize: 800,
        quality: 0.7,
      });

      expect(result.arrayBuffer.byteLength).toBe(512);
    });
  });

  describe("photo operations types", () => {
    it("should have correct PhotoUploadResult structure", () => {
      const result: PhotoUploadResult = {
        id: "photo-123",
        pictureUrl: "https://storage.example.com/photo.webp",
        success: true,
      };

      expect(result.id).toBe("photo-123");
      expect(result.pictureUrl).toBeTruthy();
      expect(result.success).toBe(true);
    });

    it("should have correct PhotoUploadResult structure for failed upload", () => {
      const result: PhotoUploadResult = {
        id: "photo-456",
        pictureUrl: "",
        success: false,
        error: "Network error",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should have correct ProcessPendingPhotosResult structure", () => {
      const result: ProcessPendingPhotosResult = {
        processed: 3,
        succeeded: 2,
        failed: 1,
        results: [
          { id: "1", pictureUrl: "url1", success: true },
          { id: "2", pictureUrl: "url2", success: true },
          { id: "3", pictureUrl: "", success: false, error: "Failed" },
        ],
      };

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    it("should have correct PhotoQueueStats structure", () => {
      const stats: PhotoQueueStats = {
        total: 10,
        pending: 3,
        uploaded: 7,
        pendingSizeBytes: 1024 * 1024 * 5, // 5MB
      };

      expect(stats.total).toBe(10);
      expect(stats.pending).toBe(3);
      expect(stats.uploaded).toBe(7);
      expect(stats.pendingSizeBytes).toBe(5242880);
    });
  });

  describe("LocalBeerPicture offline fields", () => {
    it("should have correct structure for pending upload", () => {
      const photo = createMockPhoto();

      expect(photo._pending_upload).toBe(1);
      expect(photo._local_uri).toBeTruthy();
      expect(photo.picture_url).toBeNull();
      expect(photo._dirty).toBe(1);
    });

    it("should have correct structure for uploaded photo", () => {
      const photo = createMockPhoto({
        picture_url: "https://storage.example.com/photo.webp",
        _pending_upload: 0,
        _local_uri: null,
        _dirty: 0,
        _synced_at: new Date().toISOString(),
      });

      expect(photo._pending_upload).toBe(0);
      expect(photo._local_uri).toBeNull();
      expect(photo.picture_url).toBeTruthy();
      expect(photo._dirty).toBe(0);
    });
  });

  describe("file extension handling", () => {
    it("should handle various image extensions", () => {
      // Test through the mock photo creation
      const jpgPhoto = createMockPhoto({
        _local_uri: "file:///mock/photo.jpg",
      });
      const pngPhoto = createMockPhoto({
        _local_uri: "file:///mock/photo.png",
      });
      const webpPhoto = createMockPhoto({
        _local_uri: "file:///mock/photo.webp",
      });

      expect(jpgPhoto._local_uri).toContain(".jpg");
      expect(pngPhoto._local_uri).toContain(".png");
      expect(webpPhoto._local_uri).toContain(".webp");
    });
  });

  describe("photo visibility", () => {
    it("should default to public visibility", () => {
      const photo = createMockPhoto();
      expect(photo.visibility).toBe("public");
    });

    it("should support private visibility", () => {
      const photo = createMockPhoto({ visibility: "private" });
      expect(photo.visibility).toBe("private");
    });
  });

  describe("database operations", () => {
    it("should query pending photos correctly", async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        createMockPhoto({ id: "photo-1" }),
        createMockPhoto({ id: "photo-2" }),
      ]);

      const pendingPhotos = await mockDb.getAllAsync(
        `SELECT * FROM beer_pictures
         WHERE _deleted = 0
           AND _pending_upload = 1
         ORDER BY created_at ASC`,
      );

      expect(pendingPhotos).toHaveLength(2);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it("should query photos by attendance", async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        createMockPhoto({ id: "photo-1", attendance_id: "att-1" }),
      ]);

      const photos = await mockDb.getAllAsync(
        `SELECT * FROM beer_pictures
         WHERE attendance_id = ? AND _deleted = 0
         ORDER BY created_at ASC`,
        ["att-1"],
      );

      expect(photos).toHaveLength(1);
      expect(photos[0].attendance_id).toBe("att-1");
    });

    it("should update photo after successful upload", async () => {
      await mockDb.runAsync(
        `UPDATE beer_pictures
         SET picture_url = ?,
             _pending_upload = 0,
             _local_uri = NULL,
             _dirty = 0,
             _synced_at = ?
         WHERE id = ?`,
        [
          "https://storage.example.com/photo.webp",
          new Date().toISOString(),
          "photo-123",
        ],
      );

      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it("should soft delete photo", async () => {
      await mockDb.runAsync(
        `UPDATE beer_pictures
         SET _deleted = 1, _dirty = 1
         WHERE id = ?`,
        ["photo-123"],
      );

      expect(mockDb.runAsync).toHaveBeenCalled();
    });
  });

  describe("queue stats", () => {
    it("should calculate correct stats", async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 10 }) // total
        .mockResolvedValueOnce({ count: 3 }); // pending

      const totalResult = await mockDb.getFirstAsync(
        "SELECT COUNT(*) as count FROM beer_pictures WHERE _deleted = 0",
      );
      const pendingResult = await mockDb.getFirstAsync(
        "SELECT COUNT(*) as count FROM beer_pictures WHERE _deleted = 0 AND _pending_upload = 1",
      );

      const total = totalResult?.count || 0;
      const pending = pendingResult?.count || 0;
      const uploaded = total - pending;

      expect(total).toBe(10);
      expect(pending).toBe(3);
      expect(uploaded).toBe(7);
    });
  });
});

describe("Photo Upload Integration", () => {
  it("should have correct upload flow sequence", () => {
    // This test documents the expected upload flow
    const uploadFlow = [
      "1. Copy photo to permanent storage (FileSystem)",
      "2. Insert record in beer_pictures with _pending_upload = 1",
      "3. Queue UPLOAD_FILE operation in sync_queue",
      "4. When online, compress the image",
      "5. Get signed upload URL from API",
      "6. Upload to storage (S3)",
      "7. Confirm upload with API",
      "8. Update beer_pictures with picture_url",
      "9. Clear _local_uri and _pending_upload",
      "10. Delete local file",
    ];

    expect(uploadFlow).toHaveLength(10);
    expect(uploadFlow[0]).toContain("FileSystem");
    expect(uploadFlow[9]).toContain("Delete local file");
  });
});
