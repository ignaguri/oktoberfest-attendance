import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";
import { FESTIVAL_STATUSES, FESTIVAL_TYPES } from "./enums";

export const festivals = sqliteTable("festivals", {
  id: text().primaryKey(),
  name: text().notNull(),
  short_name: text().notNull(),
  description: text(),
  location: text().notNull(),
  start_date: text().notNull(),
  end_date: text().notNull(),
  festival_type: text({ enum: FESTIVAL_TYPES }).notNull(),
  status: text({ enum: FESTIVAL_STATUSES }).notNull(),
  is_active: integer().default(1),
  beer_cost: real(),
  default_beer_price_cents: integer(),
  timezone: text().default("Europe/Berlin"),
  map_url: text(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
  ...offlineColumns,
});

export type Festival = typeof festivals.$inferSelect;
export type NewFestival = typeof festivals.$inferInsert;
