/**
 * Push Handlers
 *
 * Handles pushing local changes to the server via API calls.
 * Each handler maps a table + operation to the correct API endpoint.
 */

import { logger } from "@/lib/logger";

import { apiClient } from "../../api-client";

/**
 * Push an INSERT operation to server
 */
export async function pushInsert(
  tableName: string,
  _recordId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (tableName) {
    case "attendances":
      await apiClient.attendance.updatePersonal({
        festivalId: payload.festival_id as string,
        date: payload.date as string,
        amount: payload.beer_count as number,
        tents: payload.tents as string[] | undefined,
      });
      break;
    case "consumptions":
      await apiClient.consumption.log({
        festivalId: payload.festival_id as string,
        date: payload.date as string,
        drinkType: payload.drink_type as
          | "beer"
          | "radler"
          | "alcohol_free"
          | "wine"
          | "soft_drink"
          | "other",
        tentId: payload.tent_id as string | undefined,
        pricePaidCents: (payload.price_paid_cents as number) ?? 0,
        volumeMl: (payload.volume_ml as number) ?? 1000,
      });
      break;
    default:
      logger.warn(`[SyncManager] No insert handler for table: ${tableName}`);
  }
}

/**
 * Push an UPDATE operation to server
 */
export async function pushUpdate(
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (tableName) {
    case "attendances":
      await apiClient.attendance.updatePersonal({
        festivalId: payload.festival_id as string,
        date: payload.date as string,
        amount: payload.beer_count as number,
        tents: payload.tents as string[] | undefined,
      });
      break;
    case "consumptions": {
      // For consumptions, we update by deleting and re-creating
      // since the API doesn't have an update endpoint
      const festivalId = (payload.festivalId || payload.festival_id) as string;
      const date = payload.date as string;
      const drinkType = (payload.drinkType || payload.drink_type) as
        | "beer"
        | "radler"
        | "alcohol_free"
        | "wine"
        | "soft_drink"
        | "other";
      const pricePaidCents =
        typeof payload.pricePaidCents === "number"
          ? payload.pricePaidCents
          : typeof payload.price_paid_cents === "number"
            ? payload.price_paid_cents
            : 0;
      const volumeMl =
        typeof payload.volumeMl === "number"
          ? payload.volumeMl
          : typeof payload.volume_ml === "number"
            ? payload.volume_ml
            : 1000;

      // Delete existing and create new
      try {
        await apiClient.consumption.delete(recordId);
      } catch {
        // Ignore delete errors (record may not exist on server)
      }
      await apiClient.consumption.log({
        festivalId,
        date,
        drinkType,
        pricePaidCents,
        volumeMl,
        tentId: (payload.tentId || payload.tent_id) as string | undefined,
      });
      break;
    }
    case "profiles":
      await apiClient.profile.update({
        username: payload.username as string | undefined,
        full_name: payload.full_name as string | undefined,
      });
      break;
    default:
      logger.warn(`[SyncManager] No update handler for table: ${tableName}`);
  }
}

/**
 * Push a DELETE operation to server
 */
export async function pushDelete(
  tableName: string,
  recordId: string,
): Promise<void> {
  switch (tableName) {
    case "attendances":
      await apiClient.attendance.delete(recordId);
      break;
    case "consumptions":
      await apiClient.consumption.delete(recordId);
      break;
    default:
      logger.warn(`[SyncManager] No delete handler for table: ${tableName}`);
  }
}
