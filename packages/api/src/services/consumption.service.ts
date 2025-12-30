import type {
  IConsumptionRepository,
  IAttendanceRepository,
} from "../repositories/interfaces";
import type {
  AttendanceWithTotals,
  LogConsumptionInput,
} from "@prostcounter/shared";

import { ValidationError } from "../middleware/error";

/**
 * Consumption Service
 * Handles business logic for logging beer/drink consumption
 */
export class ConsumptionService {
  constructor(
    private consumptionRepo: IConsumptionRepository,
    private attendanceRepo: IAttendanceRepository,
  ) {}

  /**
   * Log a new consumption
   *
   * Business Logic:
   * 1. Get or create attendance for the date
   * 2. Determine pricing (tent override -> festival default -> fallback)
   * 3. Add consumption record
   * 4. TODO: Evaluate achievements (async)
   * 5. TODO: Send tent check-in notification to groups
   * 6. Return attendance with updated totals
   */
  async logConsumption(
    userId: string,
    data: LogConsumptionInput,
  ): Promise<AttendanceWithTotals> {
    const { festivalId, date, ...consumptionData } = data;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError("Date must be in YYYY-MM-DD format");
    }

    // Validate price paid >= base price (if base price provided)
    if (
      consumptionData.basePriceCents !== undefined &&
      consumptionData.pricePaidCents < consumptionData.basePriceCents
    ) {
      throw new ValidationError("Price paid cannot be less than base price");
    }

    // 1. Get or create attendance for this date
    const attendance = await this.attendanceRepo.findOrCreate(
      userId,
      festivalId,
      date,
    );

    // 2. Create consumption record (pricing logic handled in repository)
    await this.consumptionRepo.create(userId, attendance.id, consumptionData);

    // 3. Fetch updated attendance with new totals
    const updatedAttendance = await this.attendanceRepo.findById(attendance.id);

    if (!updatedAttendance) {
      throw new Error("Failed to fetch updated attendance");
    }

    // TODO Phase 4 Priority 3: Trigger achievement evaluation asynchronously
    // this.achievementService.evaluateAsync(userId, festivalId);

    // TODO Phase 4 Priority 3: Send tent check-in notification
    // if (consumptionData.tentId) {
    //   this.notificationService.notifyTentCheckIn(userId, festivalId, consumptionData.tentId);
    // }

    return updatedAttendance;
  }
}
