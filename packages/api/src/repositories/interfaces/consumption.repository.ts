import type { Consumption, LogConsumptionInput } from "@prostcounter/shared";

/**
 * Consumption repository interface
 * Provides data access for consumption records
 */
export interface IConsumptionRepository {
  /**
   * Create a new consumption record
   * @param userId - User ID who is consuming
   * @param attendanceId - Attendance record ID
   * @param data - Consumption data
   * @returns Created consumption record
   */
  create(
    userId: string,
    attendanceId: string,
    data: Omit<LogConsumptionInput, "festivalId" | "date">,
  ): Promise<Consumption>;

  /**
   * Get all consumptions for an attendance
   * @param attendanceId - Attendance record ID
   * @returns Array of consumption records
   */
  findByAttendance(attendanceId: string): Promise<Consumption[]>;

  /**
   * Get all consumptions for a user on a specific date
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @param date - Date string in YYYY-MM-DD format
   * @returns Array of consumption records
   */
  findByFestivalAndDate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<Consumption[]>;

  /**
   * Delete a consumption record
   * @param id - Consumption ID
   * @param userId - User ID (for authorization)
   */
  delete(id: string, userId: string): Promise<void>;
}
