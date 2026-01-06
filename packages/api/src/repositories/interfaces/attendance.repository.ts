import type {
  AttendanceWithTotals,
  AttendanceByDate,
  ListAttendancesQuery,
  CreateAttendanceInput,
  CreateAttendanceResponse,
  UpdatePersonalAttendanceInput,
  UpdatePersonalAttendanceResponse,
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

  /**
   * Create or update attendance with tent visits
   * Uses RPC function for atomic operation
   * @param userId - User ID
   * @param input - Attendance data including tents
   * @returns Attendance ID and whether tents changed
   */
  createWithTents(
    userId: string,
    input: CreateAttendanceInput,
  ): Promise<CreateAttendanceResponse>;

  /**
   * Update personal attendance without triggering notifications
   * Preserves existing tent visit timestamps
   * @param userId - User ID
   * @param input - Attendance data including tents
   * @returns Attendance ID and tent changes
   */
  updatePersonal(
    userId: string,
    input: UpdatePersonalAttendanceInput,
  ): Promise<UpdatePersonalAttendanceResponse>;

  /**
   * Check if a festival exists
   * @param festivalId - Festival ID
   * @returns Festival data or null
   */
  festivalExists(
    festivalId: string,
  ): Promise<{ id: string; timezone: string | null } | null>;

  /**
   * Get attendance for a specific date with pictures
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @param date - Date in YYYY-MM-DD format
   * @returns Attendance with tent IDs and picture URLs, or null if not found
   */
  getByDate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<AttendanceByDate | null>;
}
