import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { attendances } from "./attendances";
import { offlineColumns } from "./common";
import { DRINK_TYPES } from "./enums";
import { tents } from "./tents";

export const consumptions = sqliteTable(
  "consumptions",
  {
    id: text().primaryKey(),
    attendance_id: text()
      .notNull()
      .references(() => attendances.id),
    drink_type: text({ enum: DRINK_TYPES }).default("beer"),
    drink_name: text(),
    volume_ml: integer(),
    price_paid_cents: integer().notNull(),
    base_price_cents: integer().notNull(),
    tip_cents: integer(),
    tent_id: text().references(() => tents.id),
    recorded_at: text().notNull(),
    idempotency_key: text(),
    created_at: text().notNull(),
    updated_at: text().notNull(),
    ...offlineColumns,
  },
  (t) => [
    index("idx_consumptions_attendance").on(t.attendance_id),
    index("idx_consumptions_idempotency").on(t.idempotency_key),
    index("idx_consumptions_dirty")
      .on(t._dirty)
      .where(sql`${t._dirty} = 1`),
  ],
);

export type Consumption = typeof consumptions.$inferSelect;
export type NewConsumption = typeof consumptions.$inferInsert;
