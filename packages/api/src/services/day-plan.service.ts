import type {
  DayPlan,
  FriendsGoingDay,
  GetCompanionOptionsResponse,
  UpsertDayPlanInput,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";

import { ConflictError, NotFoundError, ValidationError } from "../middleware/error";
import type {
  DayPlanWrite,
  FestivalDayContext,
  IDayPlanRepository,
} from "../repositories/interfaces";

const DEFAULT_REMINDER_OFFSET_MINUTES = 30;

export interface UpsertDayPlanResult {
  plan: DayPlan;
  /** True when this save made the day visible to friends, which is what triggers the overlap push. */
  becameVisible: boolean;
  /** Today in the festival's timezone, YYYY-MM-DD. */
  today: string;
}

/**
 * A reservation that was checked in, completed or expired records a day that
 * happened; rewriting it, turning it into a plan or cancelling it would falsify
 * that.
 */
function isFinishedReservation(plan: DayPlan): boolean {
  return plan.kind === "reservation" && plan.status !== "pending" && plan.status !== "confirmed";
}

/**
 * The columns a save writes, given what the day held before.
 *
 * Editing a reservation keeps what the form does not send (status, end time,
 * reminder settings); switching to a plan clears all of it.
 */
export function buildWrite(input: UpsertDayPlanInput, existing: DayPlan | null): DayPlanWrite {
  if (input.kind === "plan") {
    return {
      kind: "plan",
      tentId: input.tentId ?? null,
      note: input.note ?? null,
      visibleToGroups: input.visibleToGroups,
      startAt: null,
      endAt: null,
      status: null,
      reminderOffsetMinutes: null,
      autoCheckin: null,
    };
  }

  const existingReservation = existing?.kind === "reservation" ? existing : null;

  return {
    kind: "reservation",
    tentId: input.tentId,
    note: input.note ?? null,
    visibleToGroups: input.visibleToGroups,
    startAt: input.startAt,
    endAt: existingReservation?.endAt ?? null,
    status: existingReservation?.status ?? "pending",
    reminderOffsetMinutes:
      input.reminderOffsetMinutes ??
      existingReservation?.reminderOffsetMinutes ??
      DEFAULT_REMINDER_OFFSET_MINUTES,
    autoCheckin: input.autoCheckin ?? existingReservation?.autoCheckin ?? false,
  };
}

/**
 * A user's single mark per festival day: a plan to go, or a reservation.
 */
export class DayPlanService {
  constructor(
    private repo: IDayPlanRepository,
    private now: () => Date = () => new Date(),
  ) {}

  async listPlans(userId: string, festivalId: string): Promise<DayPlan[]> {
    return this.repo.listActive(userId, festivalId);
  }

  async upsertPlan(
    userId: string,
    festivalId: string,
    date: string,
    input: UpsertDayPlanInput,
  ): Promise<UpsertDayPlanResult> {
    const festival = await this.requireFestival(festivalId);
    const today = this.todayIn(festival);

    if (date < festival.startDate || date > festival.endDate) {
      throw new ValidationError(ErrorCodes.DATE_OUTSIDE_FESTIVAL);
    }
    if (date < today) {
      throw new ValidationError(ErrorCodes.DAY_PLAN_DATE_IN_PAST);
    }

    if (input.kind === "reservation") {
      const startAt = new Date(input.startAt);
      if (startAt <= this.now()) {
        throw new ValidationError(ErrorCodes.RESERVATION_START_IN_PAST);
      }
      if (formatDateForDatabase(startAt, festival.timezone) !== date) {
        throw new ValidationError(ErrorCodes.DAY_PLAN_DATE_MISMATCH);
      }
    }

    const existing = await this.repo.findActiveByDate(userId, festivalId, date);

    if (existing && isFinishedReservation(existing)) {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }

    // Checked before the plan is written, so a rejected tag saves nothing
    if (input.companions) {
      await this.assertCompanionsAllowed(userId, festivalId, input.companions);
    }

    const write = buildWrite(input, existing);
    let plan = existing
      ? await this.repo.update(existing.id, userId, write)
      : await this.repo.insert(userId, festivalId, date, write);

    if (input.companions) {
      await this.repo.setCompanions(
        plan.id,
        input.companions.userIds,
        input.companions.groupIds,
      );
      // Read back, so the response carries the tags' names
      plan = (await this.repo.findActiveByDate(userId, festivalId, date)) ?? plan;
    }

    return {
      plan,
      becameVisible: plan.visibleToGroups && (!existing || !existing.visibleToGroups),
      today,
    };
  }

  async removePlan(userId: string, festivalId: string, date: string): Promise<void> {
    const existing = await this.repo.findActiveByDate(userId, festivalId, date);

    if (!existing) {
      throw new NotFoundError(ErrorCodes.DAY_PLAN_NOT_FOUND);
    }
    if (isFinishedReservation(existing)) {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }

    // A plan leaves no trace; a reservation is cancelled, as it always was.
    if (existing.kind === "plan") {
      await this.repo.deleteById(existing.id, userId);
      return;
    }

    await this.repo.cancel(existing.id, userId);
  }

  async getFriendsGoing(userId: string, festivalId: string): Promise<FriendsGoingDay[]> {
    const festival = await this.requireFestival(festivalId);
    return this.repo.listFriendsGoing(userId, festivalId, this.todayIn(festival));
  }

  async getCompanionOptions(
    userId: string,
    festivalId: string,
  ): Promise<GetCompanionOptionsResponse> {
    await this.requireFestival(festivalId);
    return this.repo.listCompanionOptions(userId, festivalId);
  }

  private async assertCompanionsAllowed(
    userId: string,
    festivalId: string,
    companions: { userIds: string[]; groupIds: string[] },
  ): Promise<void> {
    if (companions.userIds.length === 0 && companions.groupIds.length === 0) {
      return;
    }

    const options = await this.repo.listCompanionOptions(userId, festivalId);
    const allowedUserIds = new Set(options.users.map((user) => user.userId));
    const allowedGroupIds = new Set(options.groups.map((group) => group.groupId));

    if (
      companions.userIds.some((id) => !allowedUserIds.has(id)) ||
      companions.groupIds.some((id) => !allowedGroupIds.has(id))
    ) {
      throw new ValidationError(ErrorCodes.DAY_PLAN_INVALID_COMPANION);
    }
  }

  private todayIn(festival: FestivalDayContext): string {
    return formatDateForDatabase(this.now(), festival.timezone);
  }

  private async requireFestival(festivalId: string): Promise<FestivalDayContext> {
    const festival = await this.repo.getFestivalContext(festivalId);

    if (!festival) {
      throw new NotFoundError(ErrorCodes.FESTIVAL_NOT_FOUND);
    }

    return festival;
  }
}
