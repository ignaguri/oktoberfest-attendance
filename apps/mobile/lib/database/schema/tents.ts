import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";
import { DRINK_TYPES } from "./enums";
import { festivals } from "./festivals";

export const tents = sqliteTable("tents", {
  id: text().primaryKey(),
  name: text().notNull(),
  category: text(),
  ...offlineColumns,
});

export type Tent = typeof tents.$inferSelect;
export type NewTent = typeof tents.$inferInsert;

export const festivalTents = sqliteTable(
  "festival_tents",
  {
    id: text().primaryKey(),
    festival_id: text()
      .notNull()
      .references(() => festivals.id),
    tent_id: text()
      .notNull()
      .references(() => tents.id),
    beer_price: real(),
    beer_price_cents: integer(),
    created_at: text(),
    updated_at: text(),
    ...offlineColumns,
  },
  (t) => [
    unique("festival_tents_festival_tent").on(t.festival_id, t.tent_id),
    index("idx_festival_tents_festival").on(t.festival_id),
  ],
);

export type FestivalTent = typeof festivalTents.$inferSelect;
export type NewFestivalTent = typeof festivalTents.$inferInsert;

export const drinkTypePrices = sqliteTable("drink_type_prices", {
  id: text().primaryKey(),
  drink_type: text({ enum: DRINK_TYPES }).notNull(),
  price_cents: integer().notNull(),
  festival_id: text().references(() => festivals.id),
  festival_tent_id: text().references(() => festivalTents.id),
  created_at: text().notNull(),
  updated_at: text().notNull(),
  ...offlineColumns,
});

export type DrinkTypePrice = typeof drinkTypePrices.$inferSelect;
export type NewDrinkTypePrice = typeof drinkTypePrices.$inferInsert;

export const tentVisits = sqliteTable(
  "tent_visits",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    tent_id: text()
      .notNull()
      .references(() => tents.id),
    festival_id: text()
      .notNull()
      .references(() => festivals.id),
    visit_date: text(),
    ...offlineColumns,
  },
  (t) => [
    unique("tent_visits_user_tent_festival_date").on(
      t.user_id,
      t.tent_id,
      t.festival_id,
      t.visit_date,
    ),
    index("idx_tent_visits_user_festival").on(t.user_id, t.festival_id),
  ],
);

export type TentVisit = typeof tentVisits.$inferSelect;
export type NewTentVisit = typeof tentVisits.$inferInsert;
