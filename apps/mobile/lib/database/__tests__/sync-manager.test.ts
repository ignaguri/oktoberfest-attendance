/**
 * Sync Manager Tests
 *
 * Tests for the SyncManager class.
 * Run with: pnpm test --filter=@prostcounter/mobile
 *
 * Note: These tests mock the database and API client to test sync logic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSyncManager, SyncManager } from "../sync-manager";

// Mock the API client
vi.mock("../../api-client", () => ({
  apiClient: {
    festivals: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "festival-1",
            name: "Oktoberfest 2024",
            location: "Munich",
            startDate: "2024-09-21",
            endDate: "2024-10-06",
            status: "active",
            isActive: true,
            beerCost: 16.2,
            timezone: "Europe/Berlin",
            mapUrl: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
      }),
    },
    tents: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            festivalId: "festival-1",
            tentId: "tent-1",
            beerPrice: 1620,
            tent: {
              id: "tent-1",
              name: "Hofbräu Festzelt",
              category: "large",
            },
          },
        ],
      }),
    },
    achievements: {
      available: vi.fn().mockResolvedValue({
        data: [
          {
            id: "ach-1",
            name: "First Beer",
            description: "Log your first beer",
            icon: "beer",
            category: "attendance",
            rarity: "common",
            points: 10,
            is_active: true,
          },
        ],
      }),
      getWithProgress: vi.fn().mockResolvedValue({
        data: [
          {
            id: "ach-1",
            name: "First Beer",
            description: "Log your first beer",
            icon: "beer",
            category: "attendance",
            rarity: "common",
            points: 10,
            is_active: true,
            user_progress: {
              current_value: 5,
              target_value: 1,
              percentage: 100,
              last_updated: "2024-09-21T12:00:00Z",
            },
          },
        ],
        stats: {},
      }),
    },
    profile: {
      get: vi.fn().mockResolvedValue({
        profile: {
          username: "testuser",
          full_name: "Test User",
          avatar_url: null,
        },
      }),
    },
    attendance: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "att-1",
            userId: "user-1",
            festivalId: "festival-1",
            date: "2024-09-21",
            beerCount: 5,
            createdAt: "2024-09-21T12:00:00Z",
            updatedAt: "2024-09-21T14:00:00Z",
          },
        ],
      }),
      updatePersonal: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    consumption: {
      list: vi.fn().mockResolvedValue({
        consumptions: [
          {
            id: "cons-1",
            attendanceId: "att-1",
            drinkType: "beer",
            drinkName: "Hofbräu",
            volumeMl: 1000,
            pricePaidCents: 1620,
            basePriceCents: 1500,
            tipCents: 120,
            tentId: "tent-1",
            recordedAt: "2024-09-21T12:00:00Z",
            createdAt: "2024-09-21T12:00:00Z",
            updatedAt: "2024-09-21T12:00:00Z",
          },
        ],
      }),
      log: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    groups: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "group-1",
            name: "Test Group",
            description: "A test group",
            festivalId: "festival-1",
            createdBy: "user-1",
            inviteToken: "abc123",
            winningCriteria: "total_beers",
            createdAt: "2024-09-21T10:00:00Z",
            updatedAt: "2024-09-21T10:00:00Z",
            memberCount: 3,
          },
        ],
      }),
    },
  },
}));

// Mock the sync-queue module
vi.mock("../sync-queue", () => ({
  getSyncMetadata: vi.fn().mockResolvedValue(null),
  updateLastSyncAt: vi.fn().mockResolvedValue(undefined),
  enqueueOperation: vi.fn().mockResolvedValue("op-1"),
  getPendingOperations: vi.fn().mockResolvedValue([]),
  markOperationProcessing: vi.fn().mockResolvedValue(undefined),
  markOperationCompleted: vi.fn().mockResolvedValue(undefined),
  markOperationFailed: vi.fn().mockResolvedValue(undefined),
  markRecordClean: vi.fn().mockResolvedValue(undefined),
  getDirtyRecords: vi.fn().mockResolvedValue([]),
  generateUUID: vi.fn().mockReturnValue("test-uuid"),
  generateConsumptionIdempotencyKey: vi.fn().mockReturnValue("idem-key"),
  getQueueStats: vi.fn().mockResolvedValue({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }),
}));

// Create a mock database
function createMockDb() {
  const records: Record<string, Record<string, unknown>[]> = {
    festivals: [],
    tents: [],
    achievements: [],
    profiles: [],
    attendances: [],
    consumptions: [],
    groups: [],
    user_achievements: [],
  };

  return {
    getFirstAsync: vi
      .fn()
      .mockImplementation(async (query: string, params?: unknown[]) => {
        // Parse table name from query
        const match = query.match(/FROM\s+(\w+)/i);
        const table = match?.[1];
        if (!table || !records[table]) return null;

        const id = params?.[0];
        return records[table].find((r) => r.id === id) ?? null;
      }),
    getAllAsync: vi
      .fn()
      .mockImplementation(async (query: string, params?: unknown[]) => {
        const match = query.match(/FROM\s+(\w+)/i);
        const table = match?.[1];
        if (!table || !records[table]) return [];
        return records[table];
      }),
    runAsync: vi
      .fn()
      .mockImplementation(async (query: string, params?: unknown[]) => {
        // Track inserts for verification
        if (query.includes("INSERT INTO")) {
          const match = query.match(/INSERT INTO\s+(\w+)/i);
          const table = match?.[1];
          if (table && records[table]) {
            records[table].push({ id: params?.[0] as string });
          }
        }
        return { changes: 1 };
      }),
    execAsync: vi.fn().mockResolvedValue(undefined),
    // Helper for tests to access mock records
    _records: records,
  };
}

describe("SyncManager", () => {
  let syncManager: SyncManager;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    syncManager = createSyncManager(
      mockDb as unknown as Parameters<typeof createSyncManager>[0],
    );
  });

  describe("constructor", () => {
    it("should create a SyncManager instance", () => {
      expect(syncManager).toBeInstanceOf(SyncManager);
      expect(syncManager.syncing).toBe(false);
    });
  });

  describe("sync", () => {
    it("should return error when sync is already in progress", async () => {
      // Start first sync
      const firstSync = syncManager.sync({
        festivalId: "festival-1",
        userId: "user-1",
      });

      // Try to start second sync immediately
      const secondResult = await syncManager.sync({ festivalId: "festival-1" });

      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain("Sync already in progress");

      // Wait for first sync to complete
      await firstSync;
    });

    it("should complete full sync successfully", async () => {
      const result = await syncManager.sync({
        festivalId: "festival-1",
        userId: "user-1",
        direction: "both",
      });

      expect(result.success).toBe(true);
      expect(result.direction).toBe("both");
      expect(result.pulled).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should only pull when direction is pull", async () => {
      const result = await syncManager.sync({
        festivalId: "festival-1",
        userId: "user-1",
        direction: "pull",
      });

      expect(result.direction).toBe("pull");
    });

    it("should only push when direction is push", async () => {
      const result = await syncManager.sync({
        festivalId: "festival-1",
        direction: "push",
      });

      expect(result.direction).toBe("push");
    });
  });

  describe("abort", () => {
    it("should abort in-progress sync", async () => {
      // Start sync
      const syncPromise = syncManager.sync({
        festivalId: "festival-1",
        userId: "user-1",
      });

      // Abort immediately
      syncManager.abort();

      expect(syncManager.syncing).toBe(false);

      // Wait for completion
      await syncPromise;
    });
  });

  describe("getStatus", () => {
    it("should return sync status", async () => {
      const status = await syncManager.getStatus();

      expect(status).toHaveProperty("pendingOperations");
      expect(status).toHaveProperty("failedOperations");
      expect(status).toHaveProperty("dirtyRecords");
      expect(status).toHaveProperty("lastSyncAt");
    });
  });

  describe("pullFestivals", () => {
    it("should pull festivals from API", async () => {
      const result = await syncManager.pullFestivals();

      expect(result.table).toBe("festivals");
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });
  });

  describe("pullTents", () => {
    it("should pull tents from API", async () => {
      const result = await syncManager.pullTents("festival-1");

      expect(result.table).toBe("tents");
    });
  });

  describe("pullAchievements", () => {
    it("should pull achievements from API", async () => {
      const result = await syncManager.pullAchievements();

      expect(result.table).toBe("achievements");
    });
  });

  describe("pullProfile", () => {
    it("should pull user profile from API", async () => {
      const result = await syncManager.pullProfile("user-1");

      expect(result.table).toBe("profiles");
    });
  });

  describe("pullAttendances", () => {
    it("should pull attendances from API", async () => {
      const result = await syncManager.pullAttendances("festival-1");

      expect(result.table).toBe("attendances");
    });
  });

  describe("pullGroups", () => {
    it("should pull groups from API", async () => {
      const result = await syncManager.pullGroups("festival-1");

      expect(result.table).toBe("groups");
    });
  });

  describe("pullUserAchievements", () => {
    it("should pull unlocked achievements", async () => {
      const result = await syncManager.pullUserAchievements("festival-1");

      expect(result.table).toBe("user_achievements");
    });
  });
});

describe("createSyncManager", () => {
  it("should create a SyncManager with factory function", () => {
    const mockDb = createMockDb();
    const manager = createSyncManager(
      mockDb as unknown as Parameters<typeof createSyncManager>[0],
    );

    expect(manager).toBeInstanceOf(SyncManager);
  });
});
