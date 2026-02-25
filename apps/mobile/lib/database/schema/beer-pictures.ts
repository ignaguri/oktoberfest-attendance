import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { attendances } from "./attendances";
import { offlineColumns, photoColumns } from "./common";
import { PHOTO_VISIBILITIES } from "./enums";

export const beerPictures = sqliteTable(
  "beer_pictures",
  {
    id: text().primaryKey(),
    attendance_id: text()
      .notNull()
      .references(() => attendances.id),
    user_id: text().notNull(),
    picture_url: text(),
    visibility: text({ enum: PHOTO_VISIBILITIES }).default("public"),
    created_at: text().notNull(),
    ...offlineColumns,
    ...photoColumns,
  },
  (t) => [
    index("idx_beer_pictures_attendance").on(t.attendance_id),
    index("idx_beer_pictures_pending")
      .on(t._pending_upload)
      .where(sql`${t._pending_upload} = 1`),
  ],
);

export type BeerPicture = typeof beerPictures.$inferSelect;
export type NewBeerPicture = typeof beerPictures.$inferInsert;
