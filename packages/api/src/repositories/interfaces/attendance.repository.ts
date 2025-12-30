import type {
  AttendanceWithTotals,
  ListAttendancesQuery,
} from "@prostcounter/shared";

/**
 * Attendance repository interface
 * Provides data access for attendance records
 */
export interface IAttendanceRepository {
  /**
   * Find or create an attendance record for a user on a specific date
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @param date - Date in YYYY-MM-DD format
   * @returns Attendance record with computed totals
   */
  findOrCreate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<AttendanceWithTotals>;

  /**
   * Get an attendance by ID
   * @param id - Attendance ID
   * @returns Attendance record with computed totals, or null if not found
   */
  findById(id: string): Promise<AttendanceWithTotals | null>;

  /**
   * List attendances for a user and festival
   * @param userId - User ID
   * @param query - Query parameters (festivalId, limit, offset)
   * @returns Array of attendance records and total count
   */
  list(
    userId: string,
    query: ListAttendancesQuery,
  ): Promise<{ data: AttendanceWithTotals[]; total: number }>;

  /**
   * Delete an attendance record
   * Note: This will cascade delete all consumptions via ON DELETE CASCADE
   * @param id - Attendance ID
   * @param userId - User ID (for authorization)
   */
  delete(id: string, userId: string): Promise<void>;
}
