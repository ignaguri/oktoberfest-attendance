import { apiClient } from "@/lib/api-client";
import type { PendingTap } from "@/modules/live-activity";

/** Posts a lock-screen tap; its consumptionId makes a resend a no-op on the server. */
export function logPendingTap(tap: PendingTap) {
  return apiClient.consumption.log({
    festivalId: tap.festivalId,
    date: tap.date,
    drinkType: tap.drinkType,
    tentId: tap.tentId ?? undefined,
    consumptionId: tap.consumptionId,
    recordedAt: tap.tappedAt,
    volumeMl: 1000,
  });
}
