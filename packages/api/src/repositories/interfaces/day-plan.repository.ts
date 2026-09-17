import type {
  DayPlan,
  DayPlanKind,
  FriendsGoingDay,
  ReservationStatus,
} from "@prostcounter/shared";

/** Every column a save writes. Reservation-only fields are null for a plan. */
export interface DayPlanWrite {
  kind: DayPlanKind;
  tentId: string | null;
  note: string | null;
  visibleToGroups: boolean;
  startAt: string | null;
  endAt: string | null;
  status: ReservationStatus | null;
  reminderOffsetMinutes: number | null;
  autoCheckin: boolean | null;
}

/** What date validation needs to know about a festival. */
export interface FestivalDayContext {
  id: string;
  timezone: string;
  startDate: string;
  endDate: string;
}

/**
 * Day plan repository: a user's single active mark (plan or reservation) per
 * festival day. "Active" means any status except cancelled.
 */
export interface IDayPlanRepository {
  getFestivalContext(festivalId: string): Promise<FestivalDayContext | null>;

  listActive(userId: string, festivalId: string): Promise<DayPlan[]>;

  findActiveByDate(userId: string, festivalId: string, date: string): Promise<DayPlan | null>;

  /** @throws ConflictError(DAY_PLAN_CONFLICT) when the day already has an active row */
  insert(userId: string, festivalId: string, date: string, write: DayPlanWrite): Promise<DayPlan>;

  /** @throws NotFoundError(DAY_PLAN_NOT_FOUND) when the row is not the user's */
  update(id: string, userId: string, write: DayPlanWrite): Promise<DayPlan>;

  deleteById(id: string, userId: string): Promise<void>;

  /** Marks a reservation cancelled, which frees its day. */
  cancel(id: string, userId: string): Promise<DayPlan>;

  /**
   * Other users' visible plans and reservations from `fromDate` on. Visibility
   * comes from RLS, so this must run with the caller's own client.
   */
  listFriendsGoing(
    userId: string,
    festivalId: string,
    fromDate: string,
  ): Promise<FriendsGoingDay[]>;
}
