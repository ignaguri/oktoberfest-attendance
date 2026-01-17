/**
 * Schema Tests
 *
 * Tests for SQLite schema definitions and constants.
 * Run with: pnpm test --filter=@prostcounter/mobile
 *
 * Note: These tests require vitest to be installed:
 * pnpm add -D vitest @testing-library/react-native
 */

import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  DATABASE_NAME,
  CREATE_TABLES_SQL,
  CREATE_INDEXES_SQL,
  TABLE_CREATION_ORDER,
  SYNCABLE_TABLES,
  MUTABLE_TABLES,
  REFERENCE_TABLES,
} from "../schema";

describe("Schema Constants", () => {
  it("should have a valid schema version", () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
  });

  it("should have a valid database name", () => {
    expect(DATABASE_NAME).toBe("prostcounter.db");
    expect(DATABASE_NAME).toMatch(/\.db$/);
  });

  it("should have SQL for all tables in creation order", () => {
    for (const tableName of TABLE_CREATION_ORDER) {
      expect(CREATE_TABLES_SQL[tableName]).toBeDefined();
      expect(CREATE_TABLES_SQL[tableName]).toContain("CREATE TABLE");
    }
  });

  it("should have at least one index", () => {
    expect(CREATE_INDEXES_SQL.length).toBeGreaterThan(0);
    for (const indexSql of CREATE_INDEXES_SQL) {
      expect(indexSql).toContain("CREATE INDEX");
    }
  });
});

describe("Table Categorization", () => {
  it("should have syncable tables include all mutable tables", () => {
    for (const table of MUTABLE_TABLES) {
      expect(SYNCABLE_TABLES).toContain(table);
    }
  });

  it("should have syncable tables include all reference tables", () => {
    for (const table of REFERENCE_TABLES) {
      expect(SYNCABLE_TABLES).toContain(table);
    }
  });

  it("should have no overlap between mutable and reference tables", () => {
    const mutableSet = new Set(MUTABLE_TABLES);
    for (const table of REFERENCE_TABLES) {
      expect(mutableSet.has(table)).toBe(false);
    }
  });

  it("should have core tables in syncable list", () => {
    const coreTables = [
      "festivals",
      "profiles",
      "attendances",
      "consumptions",
      "beer_pictures",
    ];
    for (const table of coreTables) {
      expect(SYNCABLE_TABLES).toContain(table);
    }
  });
});

describe("SQL Syntax Validation", () => {
  it("should have valid CREATE TABLE statements", () => {
    for (const [tableName, sql] of Object.entries(CREATE_TABLES_SQL)) {
      // Basic syntax checks
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
      expect(sql).toContain("(");
      expect(sql).toContain(")");

      // Check for required offline fields (except sync tables)
      if (!tableName.startsWith("_")) {
        expect(sql).toContain("_synced_at");
        expect(sql).toContain("_deleted");
        expect(sql).toContain("_dirty");
      }
    }
  });

  it("should have sync metadata table with required columns", () => {
    const metadataSql = CREATE_TABLES_SQL._sync_metadata;
    expect(metadataSql).toContain("table_name TEXT PRIMARY KEY");
    expect(metadataSql).toContain("last_sync_at");
    expect(metadataSql).toContain("schema_version");
  });

  it("should have sync queue table with required columns", () => {
    const queueSql = CREATE_TABLES_SQL._sync_queue;
    expect(queueSql).toContain("id TEXT PRIMARY KEY");
    expect(queueSql).toContain("operation TEXT NOT NULL");
    expect(queueSql).toContain("table_name TEXT NOT NULL");
    expect(queueSql).toContain("record_id TEXT NOT NULL");
    expect(queueSql).toContain("payload TEXT NOT NULL");
    expect(queueSql).toContain("status TEXT");
    expect(queueSql).toContain("depends_on");
  });

  it("should have attendances table with unique constraint", () => {
    const sql = CREATE_TABLES_SQL.attendances;
    expect(sql).toContain("UNIQUE(user_id, festival_id, date)");
  });

  it("should have beer_pictures table with pending upload field", () => {
    const sql = CREATE_TABLES_SQL.beer_pictures;
    expect(sql).toContain("_pending_upload");
    expect(sql).toContain("_local_uri");
  });
});

describe("Table Creation Order", () => {
  it("should have metadata tables first", () => {
    expect(TABLE_CREATION_ORDER[0]).toBe("_sync_metadata");
    expect(TABLE_CREATION_ORDER[1]).toBe("_sync_queue");
  });

  it("should have reference tables before dependent tables", () => {
    const festivalIndex = TABLE_CREATION_ORDER.indexOf("festivals");
    const attendanceIndex = TABLE_CREATION_ORDER.indexOf("attendances");
    const consumptionIndex = TABLE_CREATION_ORDER.indexOf("consumptions");
    const beerPictureIndex = TABLE_CREATION_ORDER.indexOf("beer_pictures");

    // Festivals before attendances (FK dependency)
    expect(festivalIndex).toBeLessThan(attendanceIndex);

    // Attendances before consumptions (FK dependency)
    expect(attendanceIndex).toBeLessThan(consumptionIndex);

    // Attendances before beer_pictures (FK dependency)
    expect(attendanceIndex).toBeLessThan(beerPictureIndex);
  });

  it("should have tents before consumptions", () => {
    const tentIndex = TABLE_CREATION_ORDER.indexOf("tents");
    const consumptionIndex = TABLE_CREATION_ORDER.indexOf("consumptions");
    expect(tentIndex).toBeLessThan(consumptionIndex);
  });

  it("should have groups before group_members", () => {
    const groupIndex = TABLE_CREATION_ORDER.indexOf("groups");
    const memberIndex = TABLE_CREATION_ORDER.indexOf("group_members");
    expect(groupIndex).toBeLessThan(memberIndex);
  });
});

describe("Index Definitions", () => {
  it("should have index on sync queue status", () => {
    const statusIndex = CREATE_INDEXES_SQL.find((sql) =>
      sql.includes("idx_sync_queue_status"),
    );
    expect(statusIndex).toBeDefined();
    expect(statusIndex).toContain("status");
    expect(statusIndex).toContain("created_at");
  });

  it("should have index on attendances for user/festival lookup", () => {
    const attendanceIndex = CREATE_INDEXES_SQL.find((sql) =>
      sql.includes("idx_attendances_user_festival"),
    );
    expect(attendanceIndex).toBeDefined();
    expect(attendanceIndex).toContain("user_id");
    expect(attendanceIndex).toContain("festival_id");
  });

  it("should have index on consumptions idempotency key", () => {
    const idempotencyIndex = CREATE_INDEXES_SQL.find((sql) =>
      sql.includes("idx_consumptions_idempotency"),
    );
    expect(idempotencyIndex).toBeDefined();
    expect(idempotencyIndex).toContain("idempotency_key");
  });

  it("should have index on beer_pictures pending upload", () => {
    const pendingIndex = CREATE_INDEXES_SQL.find((sql) =>
      sql.includes("idx_beer_pictures_pending"),
    );
    expect(pendingIndex).toBeDefined();
    expect(pendingIndex).toContain("_pending_upload");
  });
});
