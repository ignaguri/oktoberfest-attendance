import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../../__tests__/helpers/mock-supabase";
import { SupabaseProfileRepository } from "../profile.repository";

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const row = {
  current_streak: 2,
  best_streak: 3,
  tents_visited: 7,
  tents_total: 17,
  previous_festival_name: "Oktoberfest 2025",
  previous_festival_beers: 22,
  previous_festival_days: 4,
  groups_this_festival: 0,
  accepted_friends: 0,
};

describe("SupabaseProfileRepository.getFestivalProgress", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let repo: SupabaseProfileRepository;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    repo = new SupabaseProfileRepository(mockSupabase as never);
  });

  it("maps the row and classifies a user with no groups or friends as solo", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({ data: [row], error: null } as never);

    const progress = await repo.getFestivalProgress("user-1", "festival-1");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_user_festival_progress", {
      p_festival_id: "festival-1",
    });
    expect(progress).toEqual({
      currentStreak: 2,
      bestStreak: 3,
      tentsVisited: 7,
      tentsTotal: 17,
      previousFestival: { name: "Oktoberfest 2025", beers: 22, days: 4 },
      isSolo: true,
    });
  });

  it("returns a null previous festival and social when there is a friend", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
      data: [{ ...row, previous_festival_name: null, accepted_friends: 1 }],
      error: null,
    } as never);

    const progress = await repo.getFestivalProgress("user-1", "festival-1");

    expect(progress?.previousFestival).toBeNull();
    expect(progress?.isSolo).toBe(false);
  });

  it("returns undefined instead of throwing when the RPC fails", async () => {
    vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "function does not exist" },
    } as never);

    await expect(repo.getFestivalProgress("user-1", "festival-1")).resolves.toBeUndefined();
  });
});
