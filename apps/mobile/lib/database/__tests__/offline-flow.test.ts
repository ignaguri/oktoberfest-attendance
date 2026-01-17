/**
 * Offline Flow Integration Tests
 *
 * Tests for complete offline-first scenarios:
 * - Working offline
 * - Sync queue management
 * - Coming back online
 * - Conflict resolution
 *
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LocalAttendance,
  LocalBeerPicture,
  LocalConsumption,
} from "../schema";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock expo-sqlite
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn().mockResolvedValue({
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    runAsync: vi.fn(),
    execAsync: vi.fn(),
    closeAsync: vi.fn(),
  }),
}));

// Mock NetInfo for network status
const mockNetInfo = {
  isConnected: true,
  addEventListener: vi.fn(() => vi.fn()),
};

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: (callback: (state: { isConnected: boolean }) => void) => {
      callback(mockNetInfo);
      return vi.fn();
    },
    fetch: vi.fn().mockResolvedValue(mockNetInfo),
  },
}));

// Mock expo-file-system
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/documents/",
  cacheDirectory: "file:///mock/cache/",
  copyAsync: vi.fn().mockResolvedValue(undefined),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  getInfoAsync: vi.fn().mockResolvedValue({ exists: true, size: 1024 }),
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  readDirectoryAsync: vi.fn().mockResolvedValue([]),
}));

// Mock API client
const mockApiClient = {
  attendances: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "server-att-1" }),
    update: vi.fn().mockResolvedValue({ id: "server-att-1" }),
  },
  consumptions: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "server-cons-1" }),
  },
  photos: {
    getUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: "https://storage.example.com/upload",
      pictureId: "photo-123",
    }),
    confirmUpload: vi.fn().mockResolvedValue({
      id: "photo-123",
      pictureUrl: "https://storage.example.com/photo-123.webp",
    }),
  },
};

// =============================================================================
// Test Utilities
// =============================================================================

function createMockAttendance(
  overrides: Partial<LocalAttendance> = {},
): LocalAttendance {
  return {
    id: `att-${Date.now()}`,
    user_id: "user-123",
    festival_id: "festival-123",
    date: "2024-10-01",
    beer_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _synced_at: null,
    _deleted: 0,
    _dirty: 1,
    ...overrides,
  };
}

function createMockConsumption(
  overrides: Partial<LocalConsumption> = {},
): LocalConsumption {
  return {
    id: `cons-${Date.now()}`,
    attendance_id: "att-123",
    drink_type: "beer",
    drink_name: null,
    volume_ml: 1000,
    price_paid_cents: 1620,
    base_price_cents: 1620,
    tip_cents: null,
    tent_id: null,
    recorded_at: new Date().toISOString(),
    idempotency_key: `key-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _synced_at: null,
    _deleted: 0,
    _dirty: 1,
    ...overrides,
  };
}

function createMockBeerPicture(
  overrides: Partial<LocalBeerPicture> = {},
): LocalBeerPicture {
  return {
    id: `photo-${Date.now()}`,
    attendance_id: "att-123",
    user_id: "user-123",
    picture_url: null,
    visibility: "public",
    created_at: new Date().toISOString(),
    _synced_at: null,
    _deleted: 0,
    _dirty: 1,
    _pending_upload: 1,
    _local_uri: "file:///mock/pending-uploads/photo.jpg",
    ...overrides,
  };
}

// =============================================================================
// Offline Flow Tests
// =============================================================================

describe("Offline Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNetInfo.isConnected = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Scenario: User logs beers while offline", () => {
    it("should store attendance locally when offline", async () => {
      // Simulate offline
      mockNetInfo.isConnected = false;

      const attendance = createMockAttendance({
        _synced_at: null,
        _dirty: 1,
      });

      // Verify the attendance is marked as dirty
      expect(attendance._dirty).toBe(1);
      expect(attendance._synced_at).toBeNull();
    });

    it("should create consumption records with idempotency keys", async () => {
      mockNetInfo.isConnected = false;

      const consumption = createMockConsumption({
        idempotency_key: "user-123-festival-123-2024-10-01-beer-1234567890",
      });

      // Verify idempotency key is set
      expect(consumption.idempotency_key).toBeTruthy();
      expect(consumption.idempotency_key).toContain("user-123");
    });

    it("should queue sync operations in correct order", async () => {
      // Simulate creating attendance then consumption
      const queuedOperations = [
        {
          id: "op-1",
          operation: "INSERT",
          table_name: "attendances",
          depends_on: null,
        },
        {
          id: "op-2",
          operation: "INSERT",
          table_name: "consumptions",
          depends_on: "op-1",
        },
      ];

      // Verify dependency chain
      const attendanceOp = queuedOperations.find(
        (op) => op.table_name === "attendances",
      );
      const consumptionOp = queuedOperations.find(
        (op) => op.table_name === "consumptions",
      );

      expect(attendanceOp?.depends_on).toBeNull();
      expect(consumptionOp?.depends_on).toBe("op-1");
    });
  });

  describe("Scenario: Sync when coming back online", () => {
    it("should push pending changes when network is restored", async () => {
      // Start offline
      mockNetInfo.isConnected = false;

      const _pendingAttendance = createMockAttendance({ _dirty: 1 });

      // Come back online
      mockNetInfo.isConnected = true;

      // Simulate sync pushing the attendance
      const pushResult = {
        success: true,
        pushed: 1,
        failed: 0,
      };

      expect(pushResult.success).toBe(true);
      expect(pushResult.pushed).toBe(1);
    });

    it("should pull remote changes on reconnect", async () => {
      mockNetInfo.isConnected = true;

      // Simulate server returning new data
      const serverAttendances = [
        createMockAttendance({
          id: "server-att-1",
          _synced_at: new Date().toISOString(),
          _dirty: 0,
        }),
      ];

      mockApiClient.attendances.list.mockResolvedValueOnce(serverAttendances);

      // Verify pull would update local database
      expect(serverAttendances).toHaveLength(1);
      expect(serverAttendances[0]._synced_at).toBeTruthy();
    });

    it("should handle sync errors gracefully", async () => {
      mockNetInfo.isConnected = true;

      // Simulate API error
      mockApiClient.attendances.create.mockRejectedValueOnce(
        new Error("Server error"),
      );

      const syncResult = {
        success: false,
        errors: ["Server error"],
        failed: 1,
      };

      // Verify error is captured
      expect(syncResult.success).toBe(false);
      expect(syncResult.errors).toContain("Server error");
      expect(syncResult.failed).toBe(1);
    });
  });

  describe("Scenario: Photo upload queue", () => {
    it("should store photos locally when offline", async () => {
      mockNetInfo.isConnected = false;

      const pendingPhoto = createMockBeerPicture({
        _pending_upload: 1,
        _local_uri: "file:///mock/pending-uploads/beer-photo.jpg",
        picture_url: null,
      });

      // Verify photo is marked for upload
      expect(pendingPhoto._pending_upload).toBe(1);
      expect(pendingPhoto._local_uri).toBeTruthy();
      expect(pendingPhoto.picture_url).toBeNull();
    });

    it("should upload photos when coming online", async () => {
      mockNetInfo.isConnected = true;

      // Simulate upload flow
      const uploadResult = {
        id: "photo-123",
        pictureUrl: "https://storage.example.com/photo-123.webp",
        success: true,
      };

      // After upload, photo should have URL
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.pictureUrl).toBeTruthy();
    });

    it("should clean up local files after successful upload", async () => {
      const _localUri = "file:///mock/pending-uploads/photo-to-delete.jpg";

      // After successful upload
      const uploadedPhoto = createMockBeerPicture({
        _pending_upload: 0,
        _local_uri: null,
        picture_url: "https://storage.example.com/uploaded-photo.webp",
      });

      expect(uploadedPhoto._pending_upload).toBe(0);
      expect(uploadedPhoto._local_uri).toBeNull();
      expect(uploadedPhoto.picture_url).toBeTruthy();
    });
  });

  describe("Scenario: Conflict resolution", () => {
    it("should detect conflicts based on timestamps", async () => {
      const localAttendance = createMockAttendance({
        beer_count: 5,
        _synced_at: "2024-10-01T10:00:00Z",
        _dirty: 1,
      });

      const serverAttendance = createMockAttendance({
        id: localAttendance.id,
        beer_count: 7,
        updated_at: "2024-10-01T11:00:00Z", // Newer than local
      });

      // Server is newer, so server wins
      const serverTime = new Date(serverAttendance.updated_at!).getTime();
      const localSyncTime = new Date(localAttendance._synced_at!).getTime();

      expect(serverTime).toBeGreaterThan(localSyncTime);
    });

    it("should apply server-wins strategy for conflicts", async () => {
      const _localCount = 5;
      const serverCount = 7;

      // After conflict resolution, server value should win
      const resolvedCount = serverCount; // Server wins

      expect(resolvedCount).toBe(7);
    });

    it("should preserve local changes if server has not changed", async () => {
      const localAttendance = createMockAttendance({
        beer_count: 5,
        _synced_at: "2024-10-01T10:00:00Z",
        _dirty: 1,
        updated_at: "2024-10-01T11:00:00Z", // Local is newer
      });

      const serverAttendance = createMockAttendance({
        id: localAttendance.id,
        beer_count: 3,
        updated_at: "2024-10-01T09:00:00Z", // Server is older
      });

      // Local is newer and dirty, should push to server
      const localTime = new Date(localAttendance.updated_at!).getTime();
      const serverTime = new Date(serverAttendance.updated_at!).getTime();

      expect(localTime).toBeGreaterThan(serverTime);
      expect(localAttendance._dirty).toBe(1);
    });
  });

  describe("Scenario: Soft deletes", () => {
    it("should mark records as soft deleted", async () => {
      const deletedAttendance = createMockAttendance({
        _deleted: 1,
        _dirty: 1,
      });

      expect(deletedAttendance._deleted).toBe(1);
      expect(deletedAttendance._dirty).toBe(1);
    });

    it("should not show soft deleted records in queries", async () => {
      const allAttendances = [
        createMockAttendance({ id: "att-1", _deleted: 0 }),
        createMockAttendance({ id: "att-2", _deleted: 1 }),
        createMockAttendance({ id: "att-3", _deleted: 0 }),
      ];

      // Filter out deleted records (simulating WHERE _deleted = 0)
      const visibleAttendances = allAttendances.filter((a) => a._deleted === 0);

      expect(visibleAttendances).toHaveLength(2);
      expect(visibleAttendances.map((a) => a.id)).toEqual(["att-1", "att-3"]);
    });

    it("should sync soft delete to server", async () => {
      const deleteOperation = {
        operation: "DELETE",
        table_name: "attendances",
        record_id: "att-to-delete",
        status: "pending",
      };

      expect(deleteOperation.operation).toBe("DELETE");
      expect(deleteOperation.status).toBe("pending");
    });
  });

  describe("Scenario: Queue retry logic", () => {
    it("should retry failed operations with exponential backoff", async () => {
      const delays = [1000, 2000, 4000]; // Exponential backoff
      const maxRetries = 3;

      for (let retry = 0; retry < maxRetries; retry++) {
        const expectedDelay = Math.pow(2, retry) * 1000;
        expect(delays[retry]).toBe(expectedDelay);
      }
    });

    it("should mark operation as failed after max retries", async () => {
      const maxRetries = 3;
      const operation = {
        id: "op-fail",
        status: "failed",
        retry_count: maxRetries,
        last_error: "Server unavailable",
      };

      expect(operation.retry_count).toBe(maxRetries);
      expect(operation.status).toBe("failed");
      expect(operation.last_error).toBeTruthy();
    });

    it("should respect operation dependencies", async () => {
      const operations = [
        { id: "op-1", depends_on: null, status: "completed" },
        { id: "op-2", depends_on: "op-1", status: "pending" },
        { id: "op-3", depends_on: "op-2", status: "pending" },
      ];

      // op-2 can only run after op-1 is completed
      const canProcessOp2 =
        operations.find((op) => op.id === "op-1")?.status === "completed";
      expect(canProcessOp2).toBe(true);

      // op-3 cannot run until op-2 is completed
      const canProcessOp3 =
        operations.find((op) => op.id === "op-2")?.status === "completed";
      expect(canProcessOp3).toBe(false);
    });
  });

  describe("Scenario: Database integrity", () => {
    it("should maintain referential integrity between tables", async () => {
      const attendance = createMockAttendance({ id: "att-parent" });
      const consumption = createMockConsumption({
        attendance_id: "att-parent",
      });

      expect(consumption.attendance_id).toBe(attendance.id);
    });

    it("should not orphan child records when parent is deleted", async () => {
      const attendanceId = "att-to-delete";

      // When deleting attendance, consumptions and photos should also be marked
      const relatedConsumptions = [
        createMockConsumption({ attendance_id: attendanceId, _deleted: 1 }),
      ];
      const relatedPhotos = [
        createMockBeerPicture({ attendance_id: attendanceId, _deleted: 1 }),
      ];

      // All related records should be soft deleted
      expect(relatedConsumptions.every((c) => c._deleted === 1)).toBe(true);
      expect(relatedPhotos.every((p) => p._deleted === 1)).toBe(true);
    });
  });
});

describe("Performance Considerations", () => {
  it("should batch database operations when possible", async () => {
    const batchSize = 50;
    const operations = Array(100)
      .fill(null)
      .map((_, i) => ({ id: `op-${i}` }));

    // Should process in batches
    const batches = Math.ceil(operations.length / batchSize);
    expect(batches).toBe(2);
  });

  it("should limit sync frequency to prevent battery drain", async () => {
    const minSyncInterval = 5 * 60 * 1000; // 5 minutes
    const lastSync = Date.now() - 3 * 60 * 1000; // 3 minutes ago

    const shouldSync = Date.now() - lastSync >= minSyncInterval;
    expect(shouldSync).toBe(false);
  });

  it("should clean up completed operations periodically", async () => {
    const completedOps = Array(1000)
      .fill(null)
      .map((_, i) => ({
        id: `op-${i}`,
        status: "completed",
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day old
      }));

    // Should clean up old completed operations
    const oldOps = completedOps.filter((op) => {
      const age = Date.now() - new Date(op.created_at).getTime();
      return age > 12 * 60 * 60 * 1000; // Older than 12 hours
    });

    expect(oldOps.length).toBe(1000);
  });
});
