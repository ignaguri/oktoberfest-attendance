import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";

export const profiles = sqliteTable("profiles", {
  id: text().primaryKey(),
  username: text(),
  full_name: text(),
  avatar_url: text(),
  website: text(),
  preferred_language: text(),
  tutorial_completed: integer(),
  tutorial_completed_at: text(),
  is_super_admin: integer(),
  tip_mode: text().default("ceiling_plus_1"),
  tip_fixed_amount: real(),
  updated_at: text(),
  ...offlineColumns,
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
