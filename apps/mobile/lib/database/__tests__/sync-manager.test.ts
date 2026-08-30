/**
 * Sync Manager Tests
 *
 * Tests for the SyncManager class and standalone pull functions.
 * Run with: pnpm test --filter=@prostcounter/mobile
 *
 * Note: These tests mock the database and API client to test sync logic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../api-client";
import { pullGroups } from "../sync/pull-groups";
import { pullAchievements, pullFestivals, pullTents } from "../sync/pull-reference";
import { pullAttendances, pullProfile } from "../sync/pull-user-data";
import { createSyncManager, SyncManager } from "../sync/sync-manager";

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
      getMembers: vi.fn().mockResolvedValue({
        data: [{ userId: "user-1", joinedAt: "2024-09-21T10:00:00Z" }],
      }),
    },
  },
}));

// Mock the photo-queue module so the test runner doesn't try to parse
// expo-image-manipulator's transitive react-native imports under Vite/Rollup.
vi.mock("../photo-queue", () => ({
  runUploadFileOp: vi.fn().mockResolvedValue(undefined),
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
  cleanupOrphanConsumptions: vi.fn().mockResolvedValue(0),
  cleanupOrphanTentVisits: vi.fn().mockResolvedValue(0),
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
    getFirstAsync: vi.fn().mockImplementation(async (query: string, params?: unknown[]) => {
      // Parse table name from query
      const match = query.match(/FROM\s+(\w+)/i);
      const table = match?.[1];
      if (!table || !records[table]) return null;

      const id = params?.[0];
      return records[table].find((r) => r.id === id) ?? null;
    }),
    getAllAsync: vi.fn().mockImplementation(async (query: string, _params?: unknown[]) => {
      const match = query.match(/FROM\s+(\w+)/i);
      const table = match?.[1];
      if (!table || !records[table]) return [];
      return records[table];
    }),
    runAsync: vi.fn().mockImplementation(async (query: string, params?: unknown[]) => {
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

type MockDb = ReturnType<typeof createMockDb>;

describe("SyncManager", () => {
  let syncManager: SyncManager;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    syncManager = createSyncManager(mockDb as unknown as Parameters<typeof createSyncManager>[0]);
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

    // Reproduces the cold-start auth race: the sync fires before the Supabase
    // session is restored, so every reference pull throws AuthRequiredError.
    // Omitting userId mirrors production, where auth had not resolved yet.
    it("reports failure when the reference pulls cannot authenticate", async () => {
      const authError = new Error("No authenticated session available");
      vi.mocked(apiClient.festivals.list).mockRejectedValueOnce(authError);
      vi.mocked(apiClient.tents.list).mockRejectedValueOnce(authError);
      vi.mocked(apiClient.achievements.available).mockRejectedValueOnce(authError);

      const result = await syncManager.sync({
        festivalId: "festival-1",
        direction: "pull",
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(3);
      expect(result.errors.join(" ")).toContain("No authenticated session available");
    });

    // The cold-start sync runs direction "both", so the push phase must not
    // overwrite the pull failure count on its way through.
    it("keeps pull failures when the push phase also runs", async () => {
      vi.mocked(apiClient.tents.list).mockRejectedValueOnce(new Error("boom"));

      const result = await syncManager.sync({
        festivalId: "festival-1",
        userId: "user-1",
        direction: "both",
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain("tents: boom");
    });

    it("counts a partial pull failure without failing the clean pulls", async () => {
      vi.mocked(apiClient.tents.list).mockRejectedValueOnce(new Error("boom"));

      const result = await syncManager.sync({
        festivalId: "festival-1",
        direction: "pull",
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors).toEqual(["tents: boom"]);
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
});

describe("Pull functions", () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe("pullFestivals", () => {
    it("should pull festivals from API", async () => {
      const db = mockDb as unknown as Parameters<typeof pullFestivals>[0];
      const result = await pullFestivals(db);

      expect(result.table).toBe("festivals");
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });
  });

  describe("pullTents", () => {
    it("should pull tents from API", async () => {
      const db = mockDb as unknown as Parameters<typeof pullTents>[0];
      const result = await pullTents(db, "festival-1");

      expect(result.table).toBe("tents");
    });
  });

  describe("pullAchievements", () => {
    it("should pull achievements from API", async () => {
      const db = mockDb as unknown as Parameters<typeof pullAchievements>[0];
      const result = await pullAchievements(db);

      expect(result.table).toBe("achievements");
    });
  });

  describe("pullProfile", () => {
    it("should pull user profile from API", async () => {
      const db = mockDb as unknown as Parameters<typeof pullProfile>[0];
      const result = await pullProfile(db, "user-1");

      expect(result.table).toBe("profiles");
    });
  });

  describe("pullAttendances", () => {
    it("should return both attendances and tent_visits PullResults", async () => {
      const db = mockDb as unknown as Parameters<typeof pullAttendances>[0];
      const results = await pullAttendances(db, "festival-1");

      expect(results.map((r) => r.table)).toEqual(["attendances", "tent_visits"]);
    });
  });

  describe("pullGroups", () => {
    it("should pull groups from API", async () => {
      const db = mockDb as unknown as Parameters<typeof pullGroups>[0];
      const result = await pullGroups(db, "festival-1");

      expect(result.table).toBe("groups");
    });

    // Without this reconciliation a group deleted server-side lingers locally
    // and pullGroupMembers 404s on it on every sync, forever.
    it("soft-deletes local groups the server no longer returns", async () => {
      const db = mockDb as unknown as Parameters<typeof pullGroups>[0];
      await pullGroups(db, "festival-1");

      const [sql, params] =
        mockDb.runAsync.mock.calls.find(
          ([query]) =>
            typeof query === "string" && query.includes("UPDATE groups SET _deleted = 1"),
        ) ?? [];

      expect(sql).toContain("NOT IN");
      expect(params).toContain("festival-1");
      // The group the server did return must be excluded from the delete.
      expect(params).toContain("group-1");
    });

    // The prune above must not be one-way: rejoining a group has to bring the
    // local row back rather than leave it permanently hidden.
    it("resurrects a previously pruned group that the server returns again", async () => {
      mockDb._records.groups.push({ id: "group-1" });
      const db = mockDb as unknown as Parameters<typeof pullGroups>[0];

      await pullGroups(db, "festival-1");

      const [sql] =
        mockDb.runAsync.mock.calls.find(
          ([query]) => typeof query === "string" && query.startsWith("UPDATE groups SET\n"),
        ) ?? [];

      expect(sql).toContain("_deleted = 0");
    });

    it("soft-deletes every local group when the server returns none", async () => {
      vi.mocked(apiClient.groups.list).mockResolvedValueOnce({ data: [] });
      const db = mockDb as unknown as Parameters<typeof pullGroups>[0];

      await pullGroups(db, "festival-1");

      const [sql] =
        mockDb.runAsync.mock.calls.find(
          ([query]) =>
            typeof query === "string" && query.includes("UPDATE groups SET _deleted = 1"),
        ) ?? [];

      expect(sql).toBeDefined();
      expect(sql).not.toContain("NOT IN");
    });
  });

  // A pull that threw must not be indistinguishable from a pull that found
  // nothing to do — that is what let the cold-start auth race ship silently.
  describe("failure reporting", () => {
    it("records the error on the PullResult when the API rejects", async () => {
      vi.mocked(apiClient.festivals.list).mockRejectedValueOnce(
        new Error("No authenticated session available"),
      );
      const db = mockDb as unknown as Parameters<typeof pullFestivals>[0];

      const result = await pullFestivals(db);

      expect(result.error).toBe("No authenticated session available");
      expect(result.inserted).toBe(0);
    });

    it("leaves error unset on a successful pull", async () => {
      const db = mockDb as unknown as Parameters<typeof pullFestivals>[0];

      const result = await pullFestivals(db);

      expect(result.error).toBeUndefined();
    });
  });
});

describe("createSyncManager", () => {
  it("should create a SyncManager with factory function", () => {
    const mockDb = createMockDb();
    const manager = createSyncManager(mockDb as unknown as Parameters<typeof createSyncManager>[0]);

    expect(manager).toBeInstanceOf(SyncManager);
  });
});
