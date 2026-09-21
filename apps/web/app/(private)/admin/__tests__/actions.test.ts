import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { updateUserProfile } from "../actions";

describe("updateUserProfile", () => {
  beforeEach(() => {
    single.mockReset().mockResolvedValue({ data: null, error: null });
    update.mockClear();
  });

  it("writes only the two columns the panel offers", async () => {
    // A server action accepts whatever the caller posts, so the argument's
    // type says nothing about what actually arrives here.
    await updateUserProfile("user-1", {
      full_name: "New Name",
      username: "newname",
      is_super_admin: true,
    } as { full_name?: string; username?: string });

    expect(update).toHaveBeenCalledWith({ full_name: "New Name", username: "newname" });
  });

  it("leaves out a field the caller did not send", async () => {
    await updateUserProfile("user-1", { username: "newname" });

    expect(update).toHaveBeenCalledWith({ username: "newname" });
  });

  it("reports a taken username instead of throwing", async () => {
    single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint' },
    });

    await expect(updateUserProfile("user-1", { username: "taken" })).resolves.toEqual({
      error: "USERNAME_TAKEN",
    });
  });

  it("still throws on any other database error", async () => {
    single.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(updateUserProfile("user-1", { username: "whatever" })).rejects.toThrow("denied");
  });
});
