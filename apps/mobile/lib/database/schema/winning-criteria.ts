import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";

export const winningCriteria = sqliteTable("winning_criteria", {
  id: integer().primaryKey(),
  name: text().notNull(),
  ...offlineColumns,
});

export type WinningCriteriaRow = typeof winningCriteria.$inferSelect;
export type NewWinningCriteriaRow = typeof winningCriteria.$inferInsert;
