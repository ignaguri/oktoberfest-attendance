/**
 * Shared column definitions for offline-first tables.
 *
 * Spread these into any table that participates in sync:
 *   { ...offlineColumns }
 *
 * For photo tables, also spread:
 *   { ...photoColumns }
 */

import { integer, text } from "drizzle-orm/sqlite-core";

/** Offline sync tracking columns added to all synced tables */
export const offlineColumns = {
  _synced_at: text(),
  _deleted: integer().notNull().default(0),
  _dirty: integer().notNull().default(0),
};

/** Additional columns for tables with pending file uploads */
export const photoColumns = {
  _pending_upload: integer().notNull().default(0),
  _local_uri: text(),
};
