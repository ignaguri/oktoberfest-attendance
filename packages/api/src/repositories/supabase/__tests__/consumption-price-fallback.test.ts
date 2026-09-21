import { DEFAULT_DRINK_PRICES } from "@prostcounter/shared";
import type { DrinkType } from "@prostcounter/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupabaseConsumptionRepository } from "../consumption.repository";
import {
  createMockChain,
  createMockSupabase,
  mockSupabaseError,
  mockSupabaseSuccess,
} from "../../../__tests__/helpers/mock-supabase";

/**
 * What happens when `get_drink_price_cents` cannot answer.
 *
 * The cascade is the only thing that prices a drink now, so its failure mode is
 * load-bearing: a flat fallback would store a soft drink at the beer price,
 * which is the corruption server-side resolution exists to prevent. Failing the
 * write instead is not an option either, since an offline push would drop the
 * drink.
 */
describe("Consumption pricing fallback", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const attendanceId = "22222222-2222-2222-2222-222222222222";
  const festivalId = "33333333-3333-3333-3333-333333333333";

  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let repo: SupabaseConsumptionRepository;
  let insertedRow: Record<string, unknown> | undefined;

  /**
   * Queues the three calls `create()` makes: the attendance lookup, the profile
   * read behind the tip preference, and the insert whose payload we assert on.
   */
  function mockWritePath() {
    insertedRow = undefined;

    vi.mocked(mockSupabase.from).mockReturnValueOnce(
      createMockChain(mockSupabaseSuccess({ festival_id: festivalId })),
    );
    vi.mocked(mockSupabase.from).mockReturnValueOnce(
      createMockChain(mockSupabaseSuccess({ tip_mode: "none", tip_fixed_amount: null })),
    );

    const insertChain = createMockChain(
      mockSupabaseSuccess({
        id: "44444444-4444-4444-4444-444444444444",
        attendance_id: attendanceId,
        recorded_at: "2026-09-21T14:30:00Z",
        created_at: "2026-09-21T14:30:00Z",
      }),
    );
    insertChain.insert = vi.fn((row: Record<string, unknown>) => {
      insertedRow = row;
      return insertChain;
    });
    vi.mocked(mockSupabase.from).mockReturnValueOnce(insertChain);
  }

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    repo = new SupabaseConsumptionRepository(mockSupabase);
  });

  const drinkTypes: DrinkType[] = [
    "beer",
    "radler",
    "wine",
    "soft_drink",
    "alcohol_free",
    "other",
  ];

  it.each(drinkTypes)("stores the %s default when the pricing RPC errors", async (drinkType) => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce(
      mockSupabaseError("function get_drink_price_cents does not exist", "42883") as never,
    );
    mockWritePath();

    await repo.create(userId, attendanceId, { drinkType, volumeMl: 1000 });

    expect(insertedRow?.base_price_cents).toBe(DEFAULT_DRINK_PRICES[drinkType]);
  });

  it("stores the drink type's default when the RPC returns null", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce(mockSupabaseSuccess(null) as never);
    mockWritePath();

    await repo.create(userId, attendanceId, { drinkType: "soft_drink", volumeMl: 500 });

    expect(insertedRow?.base_price_cents).toBe(DEFAULT_DRINK_PRICES.soft_drink);
  });

  it("does not price a soft drink as beer on failure", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce(
      mockSupabaseError("connection reset") as never,
    );
    mockWritePath();

    await repo.create(userId, attendanceId, { drinkType: "soft_drink", volumeMl: 500 });

    expect(insertedRow?.base_price_cents).not.toBe(DEFAULT_DRINK_PRICES.beer);
    expect(insertedRow?.price_paid_cents).toBe(DEFAULT_DRINK_PRICES.soft_drink);
  });

  it("prefers the resolved price over any default when the RPC succeeds", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce(mockSupabaseSuccess(632) as never);
    mockWritePath();

    await repo.create(userId, attendanceId, { drinkType: "soft_drink", volumeMl: 500 });

    expect(insertedRow?.base_price_cents).toBe(632);
  });
});
