import type { FriendsWentRows } from "@prostcounter/shared";

/**
 * Reads what the past-day recap shows about other users. Visibility comes from
 * RLS, so implementations must run with the caller's own client.
 */
export interface IFriendsWentRepository {
  /** The festival's timezone, or null when there is no such festival. */
  getFestivalTimezone(festivalId: string): Promise<string | null>;

  /** Everything visible about other users' attendance on one festival day. */
  listDayRows(viewerId: string, festivalId: string, date: string): Promise<FriendsWentRows>;
}
