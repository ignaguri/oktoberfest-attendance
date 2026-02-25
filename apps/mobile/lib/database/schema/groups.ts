import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { offlineColumns } from "./common";
import { festivals } from "./festivals";

export const groups = sqliteTable("groups", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  festival_id: text()
    .notNull()
    .references(() => festivals.id),
  created_by: text(),
  password: text().notNull(),
  invite_token: text(),
  token_expiration: text(),
  winning_criteria_id: integer().notNull(),
  created_at: text(),
  ...offlineColumns,
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text().primaryKey(),
    group_id: text()
      .notNull()
      .references(() => groups.id),
    user_id: text().notNull(),
    joined_at: text(),
    ...offlineColumns,
  },
  (t) => [
    unique("group_members_group_user").on(t.group_id, t.user_id),
    index("idx_group_members_user").on(t.user_id),
    index("idx_group_members_group").on(t.group_id),
  ],
);

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
