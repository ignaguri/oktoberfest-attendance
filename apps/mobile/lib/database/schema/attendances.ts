import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";
import { festivals } from "./festivals";

export const attendances = sqliteTable(
  "attendances",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    festival_id: text()
      .notNull()
      .references(() => festivals.id),
    date: text().notNull(),
    beer_count: integer().notNull().default(0),
    created_at: text(),
    updated_at: text(),
    ...offlineColumns,
  },
  (t) => [
    unique("attendances_user_festival_date").on(
      t.user_id,
      t.festival_id,
      t.date,
    ),
    index("idx_attendances_user_festival").on(t.user_id, t.festival_id),
    index("idx_attendances_date").on(t.date),
    index("idx_attendances_dirty")
      .on(t._dirty)
      .where(sql`${t._dirty} = 1`),
  ],
);

export type Attendance = typeof attendances.$inferSelect;
export type NewAttendance = typeof attendances.$inferInsert;
