import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_RARITIES } from "./enums";
import { festivals } from "./festivals";

export const achievements = sqliteTable("achievements", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  icon: text().notNull(),
  category: text({ enum: ACHIEVEMENT_CATEGORIES }).notNull(),
  rarity: text({ enum: ACHIEVEMENT_RARITIES }).default("common"),
  points: integer().default(0),
  conditions: text().default("{}"),
  is_active: integer().default(1),
  created_at: text().notNull(),
  updated_at: text().notNull(),
  ...offlineColumns,
});

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;

export const userAchievements = sqliteTable(
  "user_achievements",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    achievement_id: text()
      .notNull()
      .references(() => achievements.id),
    festival_id: text()
      .notNull()
      .references(() => festivals.id),
    unlocked_at: text().notNull(),
    progress: text(),
    ...offlineColumns,
  },
  (t) => [
    unique("user_achievements_user_achievement_festival").on(
      t.user_id,
      t.achievement_id,
      t.festival_id,
    ),
    index("idx_user_achievements_user").on(t.user_id, t.festival_id),
  ],
);

export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
