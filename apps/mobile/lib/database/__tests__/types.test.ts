/**
 * Type Utilities Tests
 *
 * Tests for type helper functions.
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { describe, expect, it } from "vitest";

import type { LocalAttendance, OfflineFields } from "../schema";

import { stripOfflineFields, needsSync, isDeleted, isSynced } from "../types";

describe("stripOfflineFields", () => {
  it("should remove _synced_at, _deleted, and _dirty fields", () => {
    const record: LocalAttendance = {
      id: "test-123",
      user_id: "user-456",
      festival_id: "festival-789",
      date: "2024-10-01",
      beer_count: 5,
      created_at: "2024-10-01T12:00:00Z",
      updated_at: "2024-10-01T14:00:00Z",
      _synced_at: "2024-10-01T14:00:00Z",
      _deleted: 0,
      _dirty: 0,
    };

    const stripped = stripOfflineFields(record);

    expect(stripped).not.toHaveProperty("_synced_at");
    expect(stripped).not.toHaveProperty("_deleted");
    expect(stripped).not.toHaveProperty("_dirty");
    expect(stripped).toHaveProperty("id", "test-123");
    expect(stripped).toHaveProperty("user_id", "user-456");
    expect(stripped).toHaveProperty("beer_count", 5);
  });

  it("should preserve all other fields", () => {
    const record: LocalAttendance = {
      id: "test-123",
      user_id: "user-456",
      festival_id: "festival-789",
      date: "2024-10-01",
      beer_count: 5,
      created_at: "2024-10-01T12:00:00Z",
      updated_at: "2024-10-01T14:00:00Z",
      _synced_at: "2024-10-01T14:00:00Z",
      _deleted: 0,
      _dirty: 0,
    };

    const stripped = stripOfflineFields(record);

    expect(Object.keys(stripped)).toHaveLength(7); // All fields except 3 offline fields

    // Access via explicit indexing to avoid TS narrowing issues
    const strippedRecord = stripped as Record<string, unknown>;
    expect(strippedRecord["id"]).toBe("test-123");
    expect(strippedRecord["user_id"]).toBe("user-456");
    expect(strippedRecord["festival_id"]).toBe("festival-789");
    expect(strippedRecord["date"]).toBe("2024-10-01");
    expect(strippedRecord["beer_count"]).toBe(5);
    expect(strippedRecord["created_at"]).toBe("2024-10-01T12:00:00Z");
    expect(strippedRecord["updated_at"]).toBe("2024-10-01T14:00:00Z");
  });
});

describe("needsSync", () => {
  it("should return true for dirty, non-deleted records", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 0,
      _dirty: 1,
    };

    expect(needsSync(record as LocalAttendance)).toBe(true);
  });

  it("should return false for clean records", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 0,
      _dirty: 0,
    };

    expect(needsSync(record as LocalAttendance)).toBe(false);
  });

  it("should return false for deleted records even if dirty", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 1,
      _dirty: 1,
    };

    expect(needsSync(record as LocalAttendance)).toBe(false);
  });

  it("should return false for never-synced, clean records", () => {
    const record: OfflineFields = {
      _synced_at: null,
      _deleted: 0,
      _dirty: 0,
    };

    expect(needsSync(record as LocalAttendance)).toBe(false);
  });
});

describe("isDeleted", () => {
  it("should return true for deleted records", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 1,
      _dirty: 0,
    };

    expect(isDeleted(record as LocalAttendance)).toBe(true);
  });

  it("should return false for active records", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 0,
      _dirty: 0,
    };

    expect(isDeleted(record as LocalAttendance)).toBe(false);
  });
});

describe("isSynced", () => {
  it("should return true for clean records with sync timestamp", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 0,
      _dirty: 0,
    };

    expect(isSynced(record as LocalAttendance)).toBe(true);
  });

  it("should return false for dirty records", () => {
    const record: OfflineFields = {
      _synced_at: "2024-10-01T12:00:00Z",
      _deleted: 0,
      _dirty: 1,
    };

    expect(isSynced(record as LocalAttendance)).toBe(false);
  });

  it("should return false for records without sync timestamp", () => {
    const record: OfflineFields = {
      _synced_at: null,
      _deleted: 0,
      _dirty: 0,
    };

    expect(isSynced(record as LocalAttendance)).toBe(false);
  });

  it("should return false for dirty records without sync timestamp", () => {
    const record: OfflineFields = {
      _synced_at: null,
      _deleted: 0,
      _dirty: 1,
    };

    expect(isSynced(record as LocalAttendance)).toBe(false);
  });
});

describe("Type Inference", () => {
  it("should allow creating records with correct types", () => {
    const attendance: LocalAttendance = {
      id: "test-id",
      user_id: "user-id",
      festival_id: "festival-id",
      date: "2024-10-01",
      beer_count: 3,
      created_at: null,
      updated_at: null,
      _synced_at: null,
      _deleted: 0,
      _dirty: 1,
    };

    expect(attendance.id).toBe("test-id");
    expect(attendance.beer_count).toBe(3);
    expect(attendance._dirty).toBe(1);
  });
});
