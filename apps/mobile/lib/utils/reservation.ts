import type { Reservation } from "@prostcounter/shared/schemas";

/**
 * Check if a reservation has an active status.
 *
 * Active statuses include:
 * - "pending" - awaiting confirmation
 * - "confirmed" - confirmed reservation
 * - "scheduled" - legacy status from older data (treated as active for backwards compatibility)
 *
 * @param reservation - The reservation to check
 * @returns true if the reservation is active
 */
export function isActiveReservation(reservation: Reservation): boolean {
  // Normal active statuses according to the current type definition
  if (reservation.status === "pending" || reservation.status === "confirmed") {
    return true;
  }

  // Legacy status handling: some older records may store "scheduled"
  // The status is typed as enum but stored as string in the database
  return (reservation.status as string) === "scheduled";
}
