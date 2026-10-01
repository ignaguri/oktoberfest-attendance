import type { WrappedData, WrappedFestival } from "@prostcounter/shared";

export interface WrappedStatus {
  /** ISO string with Z */
  unlocksAt: string;
  /** Unlock time passed, or the caller is a super admin */
  isUnlocked: boolean;
  hasAttendance: boolean;
}

/**
 * Wrapped data access. The unlock rule and cache live in SQL
 * (wrapped_unlocks_at, get_wrapped_data_cached); this layer asks and maps.
 */
export interface IWrappedRepository {
  /** Status for the signed-in caller; null when the festival does not exist. */
  getStatus(festivalId: string): Promise<WrappedStatus | null>;

  /** Cached (or freshly computed) Wrapped, mapped to camelCase. Throws if locked. */
  getWrapped(userId: string, festivalId: string): Promise<WrappedData>;

  /** Every unlocked festival the caller attended, newest first. */
  listFestivals(): Promise<WrappedFestival[]>;

  /**
   * Record the user's first view of their wrapped (no-op on later views).
   * Feeds the wrapped_viewed achievement and admin feature analytics.
   */
  markViewed(userId: string, festivalId: string): Promise<void>;

  /** persona_id of every persona card the user has opened in the collection. */
  listOpenedPersonas(userId: string): Promise<string[]>;

  /** Record that the user opened a persona card (no-op if already opened). */
  markPersonaOpened(userId: string, personaId: string): Promise<void>;

  /** Drop cached rows for a user (and festival, if given). */
  invalidateCache(userId: string, festivalId?: string): Promise<void>;

  /** Admin: recompute and upsert rows. Returns the number written. */
  regenerateCache(adminUserId: string, festivalId?: string, userId?: string): Promise<number>;

  isAdmin(userId: string): Promise<boolean>;
}
