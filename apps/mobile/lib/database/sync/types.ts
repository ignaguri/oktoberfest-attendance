/**
 * Sync Types
 *
 * Shared type definitions for the sync system.
 */

export type SyncDirection = "pull" | "push" | "both";

export interface SyncOptions {
  /** Which direction to sync */
  direction?: SyncDirection;
  /** Specific tables to sync (default: all) */
  tables?: string[];
  /** Force full sync (ignore last_sync_at) */
  force?: boolean;
  /** Festival ID to scope sync */
  festivalId?: string;
  /** User ID for user-scoped data */
  userId?: string;
}

export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  pulled: number;
  pushed: number;
  failed: number;
  errors: string[];
  duration: number;
}

export interface PullResult {
  table: string;
  inserted: number;
  updated: number;
  deleted: number;
}

export interface PushResult {
  operationId: string;
  success: boolean;
  error?: string;
}
