/**
 * Pull Groups & Achievements
 *
 * Sync operations for social/gamification tables:
 * groups, group_members, user_achievements.
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { apiClient } from "../../api-client";
import type {
  LocalGroup,
  LocalGroupMember,
  LocalUserAchievement,
} from "../schema";
import { generateUUID, updateLastSyncAt } from "../sync-queue";
import type { PullResult } from "./types";

/**
 * Pull groups from server
 */
export async function pullGroups(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
  const result: PullResult = {
    table: "groups",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.groups.list({ festivalId });
    const groups = response.data;
    const now = new Date().toISOString();

    for (const group of groups) {
      const existing = await db.getFirstAsync<LocalGroup>(
        "SELECT * FROM groups WHERE id = ?",
        [group.id],
      );

      if (existing) {
        await db.runAsync(
          `UPDATE groups SET
            name = ?, description = ?, winning_criteria_id = ?,
            _synced_at = ?, _dirty = 0
          WHERE id = ?`,
          [
            group.name,
            group.description ?? null,
            group.winningCriteria,
            now,
            group.id,
          ],
        );
        result.updated++;
      } else {
        await db.runAsync(
          `INSERT INTO groups (
            id, name, description, festival_id, created_by, password,
            invite_token, winning_criteria_id, created_at,
            _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, 0, 0)`,
          [
            group.id,
            group.name,
            group.description ?? null,
            group.festivalId,
            group.createdBy,
            group.inviteToken,
            group.winningCriteria,
            group.createdAt,
            now,
          ],
        );
        result.inserted++;
      }
    }

    await updateLastSyncAt(db, "groups", now);
  } catch (error) {
    logger.error("[SyncManager] Pull groups failed:", error);
  }

  return result;
}

/**
 * Pull group members from server for all local groups.
 * Fetches members per group via the groups API.
 */
export async function pullGroupMembers(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
  const result: PullResult = {
    table: "group_members",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    // Get all local groups for this festival
    const groups = await db.getAllAsync<LocalGroup>(
      "SELECT * FROM groups WHERE festival_id = ? AND _deleted = 0",
      [festivalId],
    );

    const now = new Date().toISOString();

    for (const group of groups) {
      try {
        const response = await apiClient.groups.getMembers(group.id);
        const members = response.data;

        for (const member of members) {
          const existing = await db.getFirstAsync<LocalGroupMember>(
            "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
            [group.id, member.userId],
          );

          if (existing) {
            await db.runAsync(
              `UPDATE group_members SET
                joined_at = ?, _synced_at = ?, _dirty = 0, _deleted = 0
              WHERE id = ?`,
              [member.joinedAt ?? now, now, existing.id],
            );
            result.updated++;
          } else {
            const id = generateUUID();
            await db.runAsync(
              `INSERT INTO group_members (
                id, group_id, user_id, joined_at,
                _synced_at, _dirty, _deleted
              ) VALUES (?, ?, ?, ?, ?, 0, 0)`,
              [id, group.id, member.userId, member.joinedAt ?? now, now],
            );
            result.inserted++;
          }
        }

        // Remove members no longer on server (soft delete)
        const serverUserIds = members.map((m) => m.userId);
        if (serverUserIds.length > 0) {
          const placeholders = serverUserIds.map(() => "?").join(",");
          const deleteResult = await db.runAsync(
            `UPDATE group_members SET _deleted = 1, _synced_at = ?
             WHERE group_id = ? AND user_id NOT IN (${placeholders}) AND _deleted = 0`,
            [now, group.id, ...serverUserIds],
          );
          result.deleted += deleteResult.changes;
        } else {
          // Server returned empty list — soft-delete all local members for this group
          const deleteResult = await db.runAsync(
            `UPDATE group_members SET _deleted = 1, _synced_at = ?
             WHERE group_id = ? AND _deleted = 0`,
            [now, group.id],
          );
          result.deleted += deleteResult.changes;
        }
      } catch (error) {
        // Log per-group error but continue with other groups
        logger.error(
          `[SyncManager] Pull members for group ${group.id} failed:`,
          error,
        );
      }
    }

    await updateLastSyncAt(db, "group_members", now);
  } catch (error) {
    logger.error("[SyncManager] Pull group members failed:", error);
  }

  return result;
}

/**
 * Pull user achievements from server
 */
export async function pullUserAchievements(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
  const result: PullResult = {
    table: "user_achievements",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.achievements.getWithProgress(festivalId);
    const achievements = response.data;
    const now = new Date().toISOString();

    for (const ach of achievements) {
      // Check if user has unlocked this achievement (100% progress)
      const userProgress = ach.user_progress;
      if (!userProgress || userProgress.percentage < 100) continue;

      const existing = await db.getFirstAsync<LocalUserAchievement>(
        "SELECT * FROM user_achievements WHERE achievement_id = ? AND festival_id = ?",
        [ach.id, festivalId],
      );

      if (!existing) {
        await db.runAsync(
          `INSERT INTO user_achievements (
            id, user_id, achievement_id, festival_id, unlocked_at, progress,
            _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
          [
            generateUUID(),
            "", // Will be set by trigger/context
            ach.id,
            festivalId,
            userProgress.last_updated ?? now,
            JSON.stringify({
              current_value: userProgress.current_value,
              target_value: userProgress.target_value,
            }),
            now,
          ],
        );
        result.inserted++;
      }
    }

    await updateLastSyncAt(db, "user_achievements", now);
  } catch (error) {
    logger.error("[SyncManager] Pull user achievements failed:", error);
  }

  return result;
}
