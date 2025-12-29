import type {
  Reservation,
  CreateReservationInput,
  ReservationStatus,
} from "@prostcounter/shared";

/**
 * Reservation repository interface
 * Provides data access for tent reservations
 */
export interface IReservationRepository {
  /**
   * Create a new reservation
   * @param userId - User ID creating the reservation
   * @param data - Reservation data
   * @returns Created reservation
   */
  create(userId: string, data: CreateReservationInput): Promise<Reservation>;

  /**
   * Find reservation by ID
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Reservation if found and owned by user
   */
  findById(id: string, userId: string): Promise<Reservation | null>;

  /**
   * List user's reservations
   * @param userId - User ID
   * @param festivalId - Optional festival filter
   * @param status - Optional status filter
   * @param upcoming - If true, only return future reservations
   * @param limit - Max results
   * @param offset - Pagination offset
   * @returns Reservations and total count
   */
  list(
    userId: string,
    festivalId?: string,
    status?: ReservationStatus,
    upcoming?: boolean,
    limit?: number,
    offset?: number
  ): Promise<{ data: Reservation[]; total: number }>;

  /**
   * Check in to a reservation
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Updated reservation
   */
  checkin(id: string, userId: string): Promise<Reservation>;

  /**
   * Cancel a reservation
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Updated reservation
   */
  cancel(id: string, userId: string): Promise<Reservation>;

  /**
   * Get upcoming reservations that need reminders
   * @param beforeMinutes - Get reservations starting within this many minutes
   * @returns Reservations needing reminders
   */
  getUpcomingForReminders(beforeMinutes: number): Promise<Reservation[]>;
}
