import type {
  Reservation,
  CreateReservationInput,
  ReservationStatus,
} from "@prostcounter/shared";
import type { IReservationRepository } from "../repositories/interfaces";
import { ValidationError, NotFoundError } from "../middleware/error";

/**
 * Reservation Service
 * Handles business logic for tent reservations and check-ins
 */
export class ReservationService {
  constructor(private reservationRepo: IReservationRepository) {}

  /**
   * Create a new reservation
   *
   * Business Logic:
   * 1. Validate reservation time (must be in future)
   * 2. Validate end time > start time
   * 3. Create reservation
   * 4. TODO: Schedule reminder notification
   *
   * @param userId - User ID creating the reservation
   * @param data - Reservation data
   * @returns Created reservation
   */
  async createReservation(
    userId: string,
    data: CreateReservationInput
  ): Promise<Reservation> {
    // Validate reservation is in the future
    const startAt = new Date(data.startAt);
    const now = new Date();

    if (startAt <= now) {
      throw new ValidationError("Reservation start time must be in the future");
    }

    // Validate end time if provided
    if (data.endAt) {
      const endAt = new Date(data.endAt);
      if (endAt <= startAt) {
        throw new ValidationError("End time must be after start time");
      }
    }

    // Create reservation
    const reservation = await this.reservationRepo.create(userId, data);

    // TODO: Schedule reminder notification
    // if (reservation.reminderOffsetMinutes > 0) {
    //   await this.scheduleReminder(reservation);
    // }

    return reservation;
  }

  /**
   * Get reservation by ID
   *
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Reservation if found
   */
  async getReservation(id: string, userId: string): Promise<Reservation> {
    const reservation = await this.reservationRepo.findById(id, userId);

    if (!reservation) {
      throw new NotFoundError("Reservation not found");
    }

    return reservation;
  }

  /**
   * List user's reservations
   *
   * @param userId - User ID
   * @param festivalId - Optional festival filter
   * @param status - Optional status filter
   * @param upcoming - If true, only return future reservations
   * @param limit - Max results
   * @param offset - Pagination offset
   * @returns Reservations and total count
   */
  async listReservations(
    userId: string,
    festivalId?: string,
    status?: ReservationStatus,
    upcoming?: boolean,
    limit = 50,
    offset = 0
  ): Promise<{ data: Reservation[]; total: number }> {
    return this.reservationRepo.list(
      userId,
      festivalId,
      status,
      upcoming,
      limit,
      offset
    );
  }

  /**
   * Check in to a reservation
   *
   * Business Logic:
   * 1. Verify reservation exists and belongs to user
   * 2. Verify reservation is in valid state (pending/confirmed)
   * 3. Check in (update status to checked_in)
   * 4. TODO: Create attendance record if auto_checkin enabled
   * 5. TODO: Send notification to group members
   *
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Updated reservation and optional attendance
   */
  async checkin(
    id: string,
    userId: string
  ): Promise<{
    reservation: Reservation;
    attendance?: { id: string; date: string };
  }> {
    // Verify reservation exists
    const existing = await this.reservationRepo.findById(id, userId);
    if (!existing) {
      throw new NotFoundError("Reservation not found");
    }

    // Check in
    const reservation = await this.reservationRepo.checkin(id, userId);

    // TODO: If auto_checkin enabled, create attendance record
    // if (reservation.autoCheckin) {
    //   const attendance = await this.createAttendanceFromReservation(reservation);
    //   return { reservation, attendance };
    // }

    // TODO: Notify group members of check-in
    // if (reservation.visibleToGroups) {
    //   await this.notifyGroupMembers(userId, reservation);
    // }

    return { reservation };
  }

  /**
   * Cancel a reservation
   *
   * @param id - Reservation ID
   * @param userId - User ID (for authorization)
   * @returns Updated reservation
   */
  async cancelReservation(id: string, userId: string): Promise<Reservation> {
    const existing = await this.reservationRepo.findById(id, userId);
    if (!existing) {
      throw new NotFoundError("Reservation not found");
    }

    return this.reservationRepo.cancel(id, userId);
  }

  /**
   * Get upcoming reservations that need reminders
   * Called by cron job
   *
   * @param beforeMinutes - Get reservations starting within this many minutes
   * @returns Reservations needing reminders
   */
  async getUpcomingForReminders(
    beforeMinutes: number
  ): Promise<Reservation[]> {
    return this.reservationRepo.getUpcomingForReminders(beforeMinutes);
  }
}
