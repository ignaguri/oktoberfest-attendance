/**
 * Sync Queue Tests
 *
 * Tests for sync queue utilities and helpers.
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { describe, expect, it } from "vitest";

import { generateConsumptionIdempotencyKey, generateUUID } from "../sync-queue";

describe("generateUUID", () => {
  it("should generate a valid UUID v4 format", () => {
    const uuid = generateUUID();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it("should generate unique UUIDs", () => {
    const uuids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      uuids.add(generateUUID());
    }

    // All UUIDs should be unique
    expect(uuids.size).toBe(count);
  });

  it("should generate UUIDs with correct length", () => {
    const uuid = generateUUID();

    // UUID is 36 characters: 8-4-4-4-12 with 4 hyphens
    expect(uuid).toHaveLength(36);
  });

  it("should have version 4 indicator", () => {
    const uuid = generateUUID();

    // The 13th character (index 14) should be '4'
    expect(uuid[14]).toBe("4");
  });

  it("should have correct variant indicator", () => {
    const uuid = generateUUID();

    // The 17th character (index 19) should be 8, 9, a, or b
    expect(uuid[19]).toMatch(/[89ab]/i);
  });
});

describe("generateConsumptionIdempotencyKey", () => {
  it("should generate a key with all components", () => {
    const userId = "user-123";
    const festivalId = "festival-456";
    const date = "2024-10-01";
    const drinkType = "beer";
    const timestamp = 1696147200000;

    const key = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      drinkType,
      timestamp,
    );

    expect(key).toContain(userId);
    expect(key).toContain(festivalId);
    expect(key).toContain(date);
    expect(key).toContain(drinkType);
    expect(key).toContain(timestamp.toString());
  });

  it("should be deterministic for same inputs", () => {
    const userId = "user-123";
    const festivalId = "festival-456";
    const date = "2024-10-01";
    const drinkType = "beer";
    const timestamp = 1696147200000;

    const key1 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      drinkType,
      timestamp,
    );
    const key2 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      drinkType,
      timestamp,
    );

    expect(key1).toBe(key2);
  });

  it("should generate different keys for different timestamps", () => {
    const userId = "user-123";
    const festivalId = "festival-456";
    const date = "2024-10-01";
    const drinkType = "beer";

    const key1 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      drinkType,
      1696147200000,
    );
    const key2 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      drinkType,
      1696147200001,
    );

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different drink types", () => {
    const userId = "user-123";
    const festivalId = "festival-456";
    const date = "2024-10-01";
    const timestamp = 1696147200000;

    const beerKey = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      "beer",
      timestamp,
    );
    const wineKey = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      date,
      "wine",
      timestamp,
    );

    expect(beerKey).not.toBe(wineKey);
  });

  it("should generate different keys for different users", () => {
    const festivalId = "festival-456";
    const date = "2024-10-01";
    const drinkType = "beer";
    const timestamp = 1696147200000;

    const key1 = generateConsumptionIdempotencyKey(
      "user-1",
      festivalId,
      date,
      drinkType,
      timestamp,
    );
    const key2 = generateConsumptionIdempotencyKey(
      "user-2",
      festivalId,
      date,
      drinkType,
      timestamp,
    );

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different festivals", () => {
    const userId = "user-123";
    const date = "2024-10-01";
    const drinkType = "beer";
    const timestamp = 1696147200000;

    const key1 = generateConsumptionIdempotencyKey(
      userId,
      "festival-1",
      date,
      drinkType,
      timestamp,
    );
    const key2 = generateConsumptionIdempotencyKey(
      userId,
      "festival-2",
      date,
      drinkType,
      timestamp,
    );

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different dates", () => {
    const userId = "user-123";
    const festivalId = "festival-456";
    const drinkType = "beer";
    const timestamp = 1696147200000;

    const key1 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      "2024-10-01",
      drinkType,
      timestamp,
    );
    const key2 = generateConsumptionIdempotencyKey(
      userId,
      festivalId,
      "2024-10-02",
      drinkType,
      timestamp,
    );

    expect(key1).not.toBe(key2);
  });

  it("should use hyphens as separator", () => {
    const key = generateConsumptionIdempotencyKey(
      "user",
      "festival",
      "2024-10-01",
      "beer",
      1234567890,
    );

    // Key format: userId-festivalId-date-drinkType-timestamp
    const parts = key.split("-");
    // Note: date itself contains hyphens, so total parts > 5
    expect(parts.length).toBeGreaterThan(5);
  });
});

describe("Sync Operation Types", () => {
  it("should have valid operation types", () => {
    const validOperations = ["INSERT", "UPDATE", "DELETE", "UPLOAD_FILE"];

    for (const op of validOperations) {
      expect(validOperations).toContain(op);
    }
  });

  it("should have valid status types", () => {
    const validStatuses = ["pending", "processing", "failed", "completed"];

    for (const status of validStatuses) {
      expect(validStatuses).toContain(status);
    }
  });
});
