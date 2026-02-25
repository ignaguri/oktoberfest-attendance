import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SYNC_OPERATION_TYPES, SYNC_STATUSES } from "./enums";

export const syncMetadata = sqliteTable("_sync_metadata", {
  table_name: text().primaryKey(),
  last_sync_at: text(),
  last_pull_cursor: text(),
  schema_version: integer().default(1),
});

export type SyncMetadataRow = typeof syncMetadata.$inferSelect;
export type NewSyncMetadataRow = typeof syncMetadata.$inferInsert;

export const syncQueue = sqliteTable(
  "_sync_queue",
  {
    id: text().primaryKey(),
    operation: text({ enum: SYNC_OPERATION_TYPES }).notNull(),
    table_name: text().notNull(),
    record_id: text().notNull(),
    payload: text().notNull(),
    idempotency_key: text(),
    depends_on: text(),
    status: text({ enum: SYNC_STATUSES }).default("pending"),
    retry_count: integer().notNull().default(0),
    last_error: text(),
    created_at: text().notNull(),
  },
  (t) => [
    index("idx_sync_queue_status").on(t.status, t.created_at),
    index("idx_sync_queue_depends").on(t.depends_on),
  ],
);

export type SyncQueueRow = typeof syncQueue.$inferSelect;
export type NewSyncQueueRow = typeof syncQueue.$inferInsert;
