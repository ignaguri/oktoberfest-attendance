/**
 * Insert Consumption Tests
 *
 * Tests for the shared insertConsumptionLocally function.
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  insertConsumptionLocally,
  type InsertConsumptionParams,
} from "../sync-queue";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockDb() {
  return {
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
    runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    execAsync: vi.fn().mockResolvedValue(undefined),
  };
}

function createDefaultParams(
  overrides: Partial<InsertConsumptionParams> = {},
): InsertConsumptionParams {
  return {
    id: "consumption-1",
    attendanceId: "attendance-1",
    festivalId: "festival-1",
    date: "2024-10-01",
    drinkType: "beer",
    drinkName: null,
    volumeMl: 1000,
    pricePaidCents: 1620,
    basePriceCents: 1620,
    tipCents: null,
    tentId: "tent-1",
    idempotencyKey: "key-1",
    now: "2024-10-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("insertConsumptionLocally", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it("should insert a consumption into the database", async () => {
    const params = createDefaultParams();

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    // First call is the INSERT
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // INSERT + enqueue
    const [sql, values] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain("INSERT INTO consumptions");
    expect(values).toContain("consumption-1");
    expect(values).toContain("attendance-1");
    expect(values).toContain("beer");
    expect(values).toContain(1000);
    expect(values).toContain(1620);
    expect(values).toContain("tent-1");
    expect(values).toContain("key-1");
  });

  it("should enqueue a sync operation after insert", async () => {
    const params = createDefaultParams();

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    // Second call is the enqueue (INSERT INTO _sync_queue)
    const [sql] = mockDb.runAsync.mock.calls[1];
    expect(sql).toContain("INSERT INTO _sync_queue");
  });

  it("should default basePriceCents to pricePaidCents when not provided", async () => {
    const params = createDefaultParams({
      basePriceCents: undefined,
      pricePaidCents: 1500,
    });

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    const [, values] = mockDb.runAsync.mock.calls[0];
    // basePriceCents should fall back to pricePaidCents (1500)
    // It's at index 6 in the values array (after id, attendanceId, drinkType, drinkName, volumeMl, pricePaidCents)
    expect(values[6]).toBe(1500);
  });

  it("should handle null optional fields", async () => {
    const params = createDefaultParams({
      drinkName: null,
      tipCents: null,
      tentId: null,
    });

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    const [, values] = mockDb.runAsync.mock.calls[0];
    expect(values[3]).toBeNull(); // drinkName
    expect(values[7]).toBeNull(); // tipCents
    expect(values[8]).toBeNull(); // tentId
  });

  it("should pass tipCents through when provided", async () => {
    const params = createDefaultParams({ tipCents: 200 });

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    const [, values] = mockDb.runAsync.mock.calls[0];
    expect(values[7]).toBe(200);
  });

  it("should propagate database errors", async () => {
    mockDb.runAsync.mockRejectedValueOnce(new Error("SQLITE_CONSTRAINT"));
    const params = createDefaultParams();

    await expect(
      insertConsumptionLocally(
        mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
        params,
      ),
    ).rejects.toThrow("SQLITE_CONSTRAINT");
  });

  it("should include idempotency key in enqueued payload", async () => {
    const params = createDefaultParams({ idempotencyKey: "unique-key-123" });

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    // The enqueue call should contain the idempotency key
    const [, values] = mockDb.runAsync.mock.calls[1];
    const valuesStr = JSON.stringify(values);
    expect(valuesStr).toContain("unique-key-123");
  });

  it("should use the provided timestamp for all date fields", async () => {
    const params = createDefaultParams({
      now: "2024-10-05T18:30:00.000Z",
    });

    await insertConsumptionLocally(
      mockDb as unknown as Parameters<typeof insertConsumptionLocally>[0],
      params,
    );

    const [, values] = mockDb.runAsync.mock.calls[0];
    // recorded_at, created_at, updated_at should all use 'now'
    const nowOccurrences = values.filter(
      (v: unknown) => v === "2024-10-05T18:30:00.000Z",
    );
    expect(nowOccurrences.length).toBe(3);
  });
});
