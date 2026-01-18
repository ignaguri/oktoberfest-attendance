import type { Reservation } from "@prostcounter/shared/schemas";

/**
 * Check if a reservation has an active status.
 *
 * Active statuses include:
 * - "pending" - awaiting confirmation
 * - "confirmed" - confirmed reservation
 *
 * @param reservation - The reservation to check
 * @returns true if the reservation is active
 */
export function isActiveReservation(reservation: Reservation): boolean {
  return reservation.status === "pending" || reservation.status === "confirmed";
}
