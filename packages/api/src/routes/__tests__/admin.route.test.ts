import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockChain, createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import adminRoutes from "../admin.route";

// The repository reaches for the service role directly; stub the module so the
// tests neither need credentials nor touch a real auth directory.
const mockListUsers = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserById = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: mockListUsers,
        getUserById: mockGetUserById,
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
      },
    },
  }),
  deleteAuthUser: vi.fn(),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const ATTENDANCE_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_ID = "88888888-8888-4888-8888-888888888888";
const FESTIVAL_ID = "99999999-9999-4999-8999-999999999999";
const TENT_ID = "44444444-4444-4444-8444-444444444444";
const FESTIVAL_TENT_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_FESTIVAL_ID = "66666666-6666-4666-8666-666666666666";

/** A `festival_tents` row as `updateFestivalTentPrice` selects it back. */
const festivalTentRow = (beerPrice: number | null) => ({
  id: FESTIVAL_TENT_ID,
  beer_price: beerPrice,
  tent: { id: TENT_ID, name: "Schottenhamel", category: "large" },
});

describe("Admin Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();
    mockUser.id = ADMIN_ID;

    mockListUsers.mockReset();
    mockGetUserById.mockReset();
    mockUpdateUserById.mockReset();
    mockDeleteUser.mockReset();

    // Stands in for authMiddleware + requireAdmin. The guard itself is covered
    // in middleware/__tests__/require-admin.test.ts; these tests exercise the
    // handlers on the assumption it already passed.
    app.use("*", async (c, next) => {
      if (!c.req.header("Authorization")) {
        return c.json({ error: "Unauthorized", message: "Missing authorization header" }, 401);
      }
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    app.route("/", adminRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/users", () => {
    it("returns users merged with their profiles", async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: OTHER_ID, email: "someone@example.com", created_at: "2026-01-01T00:00:00Z" },
          ],
        },
        error: null,
      });
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: OTHER_ID,
              username: "someone",
              full_name: "Some One",
              avatar_url: null,
              is_super_admin: false,
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest("/admin/users"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.users).toHaveLength(1);
      expect(body.users[0].email).toBe("someone@example.com");
      expect(body.users[0].profile.username).toBe("someone");
      expect(body.totalCount).toBe(1);
      expect(body.truncated).toBe(false);
    });

    it("requires an authorization header", async () => {
      const res = await app.request("/admin/users");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /admin/users/:userId/profile", () => {
    it("updates another user's profile", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/users/${OTHER_ID}/profile`, {
          method: "PATCH",
          body: JSON.stringify({ is_super_admin: true }),
        }),
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
    });

    it("refuses to let an admin revoke their own access", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/users/${ADMIN_ID}/profile`, {
          method: "PATCH",
          body: JSON.stringify({ is_super_admin: false }),
        }),
      );

      expect(res.status).toBe(403);
      // The write must not have been attempted at all.
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("still allows an admin to edit their own non-admin fields", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/users/${ADMIN_ID}/profile`, {
          method: "PATCH",
          body: JSON.stringify({ full_name: "Renamed" }),
        }),
      );

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /admin/users/:userId", () => {
    it("deletes another user", async () => {
      mockDeleteUser.mockResolvedValue({ error: null });

      const res = await app.request(
        createAuthRequest(`/admin/users/${OTHER_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      expect(mockDeleteUser).toHaveBeenCalledWith(OTHER_ID);
    });

    it("refuses to let an admin delete their own account", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/users/${ADMIN_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(403);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /admin/users/:userId/auth", () => {
    it("rejects a body with neither email nor password", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/users/${OTHER_ID}/auth`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects a password shorter than 8 characters", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/users/${OTHER_ID}/auth`, {
          method: "PATCH",
          body: JSON.stringify({ password: "short" }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("changes a password through the service role", async () => {
      mockUpdateUserById.mockResolvedValue({ error: null });

      const res = await app.request(
        createAuthRequest(`/admin/users/${OTHER_ID}/auth`, {
          method: "PATCH",
          body: JSON.stringify({ password: "a-long-enough-password" }),
        }),
      );

      expect(res.status).toBe(200);
      expect(mockUpdateUserById).toHaveBeenCalledWith(OTHER_ID, {
        password: "a-long-enough-password",
      });
    });
  });

  describe("GET /admin/users/:userId/attendances", () => {
    it("groups tent visits onto the matching day", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain({
            data: [
              {
                id: ATTENDANCE_ID,
                user_id: OTHER_ID,
                festival_id: "44444444-4444-4444-8444-444444444444",
                date: "2026-09-20",
                beer_count: 3,
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          createMockChain({
            data: [
              {
                tent_id: "55555555-5555-4555-8555-555555555555",
                visit_date: "2026-09-20T21:00:00Z",
                festival_id: "44444444-4444-4444-8444-444444444444",
              },
              {
                tent_id: "66666666-6666-4666-8666-666666666666",
                visit_date: "2026-09-21T10:00:00Z",
                festival_id: "44444444-4444-4444-8444-444444444444",
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          createMockChain({
            data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
            error: null,
          }),
        );

      const res = await app.request(createAuthRequest(`/admin/users/${OTHER_ID}/attendances`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      // Only the visit on 2026-09-20 belongs to this attendance, even though it
      // was logged at 21:00 -- the timestamp is bucketed by its festival day.
      expect(body.attendances[0].tent_ids).toEqual(["55555555-5555-4555-8555-555555555555"]);
    });

    // The regression the UTC-slicing version got wrong: 23:00 UTC is already
    // the next day in Munich, which is the calendar the DB buckets by since
    // 20260811100000_bucket_tent_visits_by_festival_timezone.
    it("buckets a visit after local midnight onto the local day", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain({
            data: [
              {
                id: ATTENDANCE_ID,
                user_id: OTHER_ID,
                festival_id: "44444444-4444-4444-8444-444444444444",
                date: "2026-09-20",
                beer_count: 3,
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          createMockChain({
            data: [
              {
                tent_id: "55555555-5555-4555-8555-555555555555",
                visit_date: "2026-09-20T23:00:00Z",
                festival_id: "44444444-4444-4444-8444-444444444444",
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          createMockChain({
            data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
            error: null,
          }),
        );

      const res = await app.request(createAuthRequest(`/admin/users/${OTHER_ID}/attendances`));

      const body = (await res.json()) as any;
      // 01:00 on the 21st in Munich, so it belongs to the 21st, not this row.
      expect(body.attendances[0].tent_ids).toEqual([]);
    });

    // attendances.beer_count has not been written since
    // 20260317130000_stop_writing_beer_count, so reading the table directly
    // reports 0 beers for every day created since. The view counts
    // consumptions and only falls back to the column when a day has none.
    it("reads the count from attendance_with_totals, not attendances", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain({
            data: [
              {
                id: ATTENDANCE_ID,
                user_id: OTHER_ID,
                festival_id: "44444444-4444-4444-8444-444444444444",
                date: "2026-09-20",
                beer_count: 7,
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(
          createMockChain({
            data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
            error: null,
          }),
        );

      const res = await app.request(createAuthRequest(`/admin/users/${OTHER_ID}/attendances`));

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenNthCalledWith(1, "attendance_with_totals");
      const body = (await res.json()) as any;
      expect(body.attendances[0].beer_count).toBe(7);
    });
  });

  describe("GET /admin/groups", () => {
    it("returns groups with their member counts and no password", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: GROUP_ID,
              name: "Test Group",
              description: "A group",
              winning_criteria_id: 1,
              festival_id: "44444444-4444-4444-8444-444444444444",
              created_at: "2026-01-01T00:00:00Z",
              created_by: OTHER_ID,
              group_members: [{ count: 4 }],
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest("/admin/groups"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.groups[0].member_count).toBe(4);
      // group_members is an implementation detail of the count query, and
      // password must never reach a client even for an admin.
      expect(body.groups[0]).not.toHaveProperty("group_members");
      expect(body.groups[0]).not.toHaveProperty("password");
      expect(body.groups[0]).not.toHaveProperty("invite_token");
    });

    it("reports zero members when the count comes back empty", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: GROUP_ID,
              name: "Empty Group",
              description: null,
              winning_criteria_id: 1,
              festival_id: "44444444-4444-4444-8444-444444444444",
              created_at: null,
              created_by: null,
              group_members: [],
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest("/admin/groups"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.groups[0].member_count).toBe(0);
    });
  });

  describe("GET /admin/groups/:groupId/members", () => {
    it("flattens the joined profile onto each member", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              user_id: OTHER_ID,
              joined_at: "2026-02-01T00:00:00Z",
              profiles: { username: "someone", full_name: "Some One", avatar_url: null },
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest(`/admin/groups/${GROUP_ID}/members`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.members[0].username).toBe("someone");
      expect(body.members[0].full_name).toBe("Some One");
    });

    // group_members.user_id is nullable, so an inner join would drop these rows
    // -- and the screen prints member_count, which counts every row, directly
    // above the list. The two must not disagree.
    it("keeps a member whose profile did not join", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              user_id: null,
              joined_at: null,
              profiles: null,
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest(`/admin/groups/${GROUP_ID}/members`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.members).toHaveLength(1);
      expect(body.members[0].username).toBeNull();
      expect(body.members[0].user_id).toBeNull();
    });

    it("handles the join arriving as an array", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              user_id: OTHER_ID,
              joined_at: null,
              profiles: [{ username: "arrayform", full_name: null, avatar_url: null }],
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest(`/admin/groups/${GROUP_ID}/members`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.members[0].username).toBe("arrayform");
    });
  });

  describe("DELETE /admin/groups/:groupId", () => {
    it("deletes the group", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: [{ id: GROUP_ID }], error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("groups");
    });

    // PostgREST counts a delete matching no rows as a success. Reported as a
    // 200, the screen closes its confirm dialog and navigates back, giving the
    // admin the whole "deleted" experience for a delete that removed nothing.
    it("404s when the group is already gone", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(createMockChain({ data: [], error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /admin/groups/:groupId", () => {
    it("rejects an empty group name", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "" }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("updates the group", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: [{ id: GROUP_ID }], error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "Renamed" }),
        }),
      );

      expect(res.status).toBe(200);
    });

    // Without the row check this reports a saved rename for a group another
    // admin has already deleted, and the detail screen leaves edit mode showing
    // the new name as if it had stuck.
    it("404s when the group no longer exists", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(createMockChain({ data: [], error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "Renamed" }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /admin/attendances/:attendanceId", () => {
    // The day's visits are cleared by id. Matching `visit_date` against the
    // calendar day compares it to midnight UTC, deletes nothing, and turns this
    // replace into an append: edit twice and every tent appears twice.
    it("clears the day's existing visits by id before inserting", async () => {
      const attendanceChain = createMockChain({
        data: {
          id: ATTENDANCE_ID,
          user_id: OTHER_ID,
          festival_id: "44444444-4444-4444-8444-444444444444",
          date: "2026-09-20",
        },
        error: null,
      });
      const festivalChain = createMockChain({
        data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
        error: null,
      });
      const staleChain = createMockChain({
        data: [{ id: "77777777-7777-4777-8777-777777777777", visit_date: "2026-09-20T19:00:00Z" }],
        error: null,
      });
      const deleteChain = createMockChain({ data: null, error: null });
      const insertChain = createMockChain({ data: null, error: null });

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(festivalChain)
        .mockReturnValueOnce(staleChain)
        .mockReturnValueOnce(deleteChain)
        .mockReturnValueOnce(insertChain);

      const res = await app.request(
        createAuthRequest(`/admin/attendances/${ATTENDANCE_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ tent_ids: ["55555555-5555-4555-8555-555555555555"] }),
        }),
      );

      expect(res.status).toBe(200);
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(deleteChain.in).toHaveBeenCalledWith("id", ["77777777-7777-4777-8777-777777777777"]);

      // The insert must carry an instant, not the bare day: a date-only string
      // stores midnight UTC, which buckets to the previous local day west of
      // Greenwich and is indistinguishable from a real visit time.
      const [inserted] = insertChain.insert.mock.calls[0];
      expect(inserted[0].visit_date).not.toBe("2026-09-20");
      expect(new Date(inserted[0].visit_date).toISOString()).toBe("2026-09-20T10:00:00.000Z");
    });

    // Clearing only the new day strands the old day's visits: nothing covers
    // them, listUserAttendances groups by festival|date and stops showing
    // them, and they keep feeding leaderboards and achievements.
    it("clears the old day's visits too when the date moves", async () => {
      const attendanceChain = createMockChain({
        data: {
          id: ATTENDANCE_ID,
          user_id: OTHER_ID,
          festival_id: "44444444-4444-4444-8444-444444444444",
          date: "2026-09-20",
        },
        error: null,
      });
      const updateChain = createMockChain({ data: null, error: null });
      const festivalChain = createMockChain({
        data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
        error: null,
      });
      const oldDayChain = createMockChain({
        data: [{ id: "77777777-7777-4777-8777-777777777777", visit_date: "2026-09-20T19:00:00Z" }],
        error: null,
      });
      const newDayChain = createMockChain({
        data: [{ id: "88888888-8888-4888-8888-888888888881", visit_date: "2026-09-22T19:00:00Z" }],
        error: null,
      });
      const deleteChain = createMockChain({ data: null, error: null });
      const insertChain = createMockChain({ data: null, error: null });

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(festivalChain)
        .mockReturnValueOnce(oldDayChain)
        .mockReturnValueOnce(newDayChain)
        .mockReturnValueOnce(deleteChain)
        .mockReturnValueOnce(insertChain);

      const res = await app.request(
        createAuthRequest(`/admin/attendances/${ATTENDANCE_ID}`, {
          method: "PATCH",
          body: JSON.stringify({
            date: "2026-09-22",
            tent_ids: ["55555555-5555-4555-8555-555555555555"],
          }),
        }),
      );

      expect(res.status).toBe(200);
      expect(deleteChain.in).toHaveBeenCalledWith("id", [
        "77777777-7777-4777-8777-777777777777",
        "88888888-8888-4888-8888-888888888881",
      ]);
    });

    // attendances carries UNIQUE(user_id, festival_id, date). Moving a day onto
    // one the user already has used to escape as a raw 500.
    it("answers 409 when the target date is already taken", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(
          createMockChain({
            data: {
              id: ATTENDANCE_ID,
              user_id: OTHER_ID,
              festival_id: "44444444-4444-4444-8444-444444444444",
              date: "2026-09-20",
            },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          createMockChain({
            data: null,
            error: { code: "23505", message: "duplicate key" },
          }),
        );

      const res = await app.request(
        createAuthRequest(`/admin/attendances/${ATTENDANCE_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ date: "2026-09-22" }),
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("DUPLICATE_ATTENDANCE");
    });
  });

  describe("DELETE /admin/festivals/:festivalId", () => {
    it("refuses with 409 when attendances still reference the festival", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [{ id: ATTENDANCE_ID }], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error.message).toMatch(/attendance/i);
    });

    it("refuses with 409 when groups still reference the festival", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [{ id: GROUP_ID }], error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error.message).toMatch(/group/i);
    });

    // tent_visits_festival_id_fkey has no ON DELETE CASCADE either, so a
    // festival whose attendances were already cleaned up but whose tent visits
    // were not used to pass both guards and die on the constraint as a 500.
    it("refuses with 409 when tent visits still reference the festival", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(
          createMockChain({ data: [{ id: "77777777-7777-4777-8777-777777777777" }], error: null }),
        );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error.message).toMatch(/tent visit/i);
    });

    it("deletes when nothing references the festival", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /admin/festivals/:festivalId", () => {
    const STORED = {
      id: FESTIVAL_ID,
      name: "Stored Fest",
      short_name: "SF",
      festival_type: "other",
      location: "Munich",
      start_date: "2026-09-19",
      end_date: "2026-09-20",
      map_url: null,
      timezone: "Europe/Berlin",
      is_active: false,
      status: "upcoming",
      description: null,
      beer_cost: null,
      created_at: "2026-09-19T00:00:00Z",
      updated_at: "2026-09-19T00:00:00Z",
    };

    // The schema can only compare two dates it was given. A lone end_date has
    // to be checked against the stored start_date, or this writes a festival
    // that ends before it starts -- no CHECK constraint catches that, and
    // isFestivalLive then never matches it again.
    it("rejects an end_date before the stored start_date", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: STORED, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ end_date: "2026-09-18" }),
        }),
      );

      expect(res.status).toBe(400);
    });

    // Sweeping before knowing the target exists cleared is_active on the real
    // active festival and then failed, leaving none active at all.
    it("404s without touching the active flag when the festival is gone", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "Renamed" }),
        }),
      );

      expect(res.status).toBe(404);
      // One call: the update that found nothing. No deactivate sweep.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(1);
    });
  });

  describe("POST /admin/festivals", () => {
    it("rejects an end_date before start_date", async () => {
      const res = await app.request(
        createAuthRequest("/admin/festivals", {
          method: "POST",
          body: JSON.stringify({
            name: "Backwards Fest",
            short_name: "BF",
            festival_type: "other",
            location: "Nowhere",
            start_date: "2026-09-20",
            end_date: "2026-09-19",
            status: "upcoming",
          }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("rejects a non-positive beer_cost, matching the database CHECK", async () => {
      const res = await app.request(
        createAuthRequest("/admin/festivals", {
          method: "POST",
          body: JSON.stringify({
            name: "Free Fest",
            short_name: "FF",
            festival_type: "other",
            location: "Somewhere",
            start_date: "2026-09-19",
            end_date: "2026-09-20",
            status: "upcoming",
            beer_cost: 0,
          }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    // The sweep has to run before the flag can be set, because
    // idx_festivals_single_active is a unique partial index. What must not
    // happen is the sweep running first and the insert then failing, which
    // would leave no active festival at all -- so the row is inserted
    // inactive, then swept, then activated.
    it("inserts inactive, then sweeps, then activates", async () => {
      const festivalRow = {
        id: FESTIVAL_ID,
        name: "New Fest",
        short_name: "NF",
        festival_type: "other",
        location: "Munich",
        start_date: "2026-09-19",
        end_date: "2026-09-20",
        map_url: null,
        timezone: "Europe/Berlin",
        is_active: false,
        status: "upcoming",
        description: null,
        beer_cost: null,
        created_at: "2026-09-19T00:00:00Z",
        updated_at: "2026-09-19T00:00:00Z",
      };

      const insertChain = createMockChain({ data: festivalRow, error: null });
      const sweepChain = createMockChain({ data: null, error: null });
      const activateChain = createMockChain({
        data: { ...festivalRow, is_active: true },
        error: null,
      });

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(sweepChain)
        .mockReturnValueOnce(activateChain);

      const res = await app.request(
        createAuthRequest("/admin/festivals", {
          method: "POST",
          body: JSON.stringify({
            name: "New Fest",
            short_name: "NF",
            festival_type: "other",
            location: "Munich",
            start_date: "2026-09-19",
            end_date: "2026-09-20",
            status: "upcoming",
            is_active: true,
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(3);
      // The insert must not carry is_active: true, or it races the index
      // against the festival that is still active at that point.
      expect(insertChain.insert.mock.calls[0][0].is_active).toBe(false);
      const body = (await res.json()) as any;
      expect(body.festival.is_active).toBe(true);
    });

    it("rejects a date that is well-formed but not a real day", async () => {
      const res = await app.request(
        createAuthRequest("/admin/festivals", {
          method: "POST",
          body: JSON.stringify({
            name: "Impossible Fest",
            short_name: "IF",
            festival_type: "other",
            location: "Nowhere",
            start_date: "2026-02-30",
            end_date: "2026-03-01",
            status: "upcoming",
          }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /admin/attendances/:attendanceId", () => {
    it("deletes the attendance", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/attendances/${ATTENDANCE_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("attendances");
    });

    // tent_visits has no FK to attendances, so nothing else removes them. Left
    // behind, they stay readable by the user's own app and reattach themselves
    // to the next attendance created for that day.
    it("takes that day's tent visits with it", async () => {
      const attendanceChain = createMockChain({
        data: {
          id: ATTENDANCE_ID,
          user_id: OTHER_ID,
          festival_id: "44444444-4444-4444-8444-444444444444",
          date: "2026-09-20",
        },
        error: null,
      });
      const festivalChain = createMockChain({
        data: [{ id: "44444444-4444-4444-8444-444444444444", timezone: "Europe/Berlin" }],
        error: null,
      });
      const visitsChain = createMockChain({
        data: [{ id: "77777777-7777-4777-8777-777777777777", visit_date: "2026-09-20T19:00:00Z" }],
        error: null,
      });
      const visitDeleteChain = createMockChain({ data: null, error: null });
      const attendanceDeleteChain = createMockChain({ data: null, error: null });

      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(festivalChain)
        .mockReturnValueOnce(visitsChain)
        .mockReturnValueOnce(visitDeleteChain)
        .mockReturnValueOnce(attendanceDeleteChain);

      const res = await app.request(
        createAuthRequest(`/admin/attendances/${ATTENDANCE_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      expect(visitDeleteChain.in).toHaveBeenCalledWith("id", [
        "77777777-7777-4777-8777-777777777777",
      ]);
      expect(attendanceDeleteChain.delete).toHaveBeenCalled();
    });
  });

  describe("PATCH /admin/festivals/:festivalId/tents/:tentId", () => {
    it("writes the canonical drink_type_prices row, not just the tent columns", async () => {
      vi.mocked(mockSupabase.from)
        // festival_tents update
        .mockReturnValueOnce(createMockChain({ data: festivalTentRow(9.5), error: null }))
        // drink_type_prices read-back: no existing row
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        // drink_type_prices insert
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ beer_price: 9.5 }),
        }),
      );

      expect(res.status).toBe(200);
      // The point of the write-through: a price that lands only in
      // festival_tents leaves pricing.repository reading a stale value.
      expect(mockSupabase.from).toHaveBeenCalledWith("festival_tents");
      expect(mockSupabase.from).toHaveBeenCalledWith("drink_type_prices");
    });

    it("clears a price by deleting the canonical row rather than storing zero", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: festivalTentRow(null), error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ beer_price: null }),
        }),
      );

      expect(res.status).toBe(200);
      // Two calls only: the update and the delete. A zero row would violate
      // drink_type_prices_positive_price anyway.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("drink_type_prices");
    });

    it("rejects a non-positive price, matching the database CHECK", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ beer_price: 0 }),
        }),
      );

      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("404s when the tent is not assigned to this festival", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ beer_price: 9.5 }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/festivals/:festivalId/tents/:tentId", () => {
    it("refuses with 409 when people have visited the tent here", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: [{ id: "visit-1" }], error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error.message).toMatch(/visit/i);
    });

    it("removes the tent when it has no visits", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/${TENT_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("tent_visits");
      expect(mockSupabase.from).toHaveBeenCalledWith("festival_tents");
    });
  });

  describe("POST /admin/festivals/:festivalId/tents/copy", () => {
    it("skips tents the target festival already serves", async () => {
      vi.mocked(mockSupabase.from)
        // source rows
        .mockReturnValueOnce(
          createMockChain({ data: [{ tent_id: TENT_ID, beer_price: 9.5 }], error: null }),
        )
        // target already has it
        .mockReturnValueOnce(createMockChain({ data: [{ tent_id: TENT_ID }], error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents/copy`, {
          method: "POST",
          body: JSON.stringify({
            source_festival_id: SOURCE_FESTIVAL_ID,
            tent_ids: [TENT_ID],
            copy_prices: true,
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.copied).toBe(0);
      // No insert: overwriting would clobber the target's own price.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(2);
    });
  });

  describe("POST /admin/festivals/:festivalId/tents", () => {
    it("treats a re-add as success rather than surfacing the unique violation", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: null,
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "unique_festival_tent"',
          },
        }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents`, {
          method: "POST",
          body: JSON.stringify({ tent_id: TENT_ID }),
        }),
      );

      // The tent is already served, which is the state the caller asked for.
      // A double tap on the picker should not report a failed add.
      expect(res.status).toBe(201);
      // Nothing else to do: no price came with the request.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(1);
    });

    it("still applies a price sent with a duplicate add", async () => {
      vi.mocked(mockSupabase.from)
        // the insert, rejected by unique_festival_tent
        .mockReturnValueOnce(
          createMockChain({ data: null, error: { code: "23505", message: "duplicate key" } }),
        )
        // falls through to the price update on the existing assignment
        .mockReturnValueOnce(createMockChain({ data: festivalTentRow(9.5), error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents`, {
          method: "POST",
          body: JSON.stringify({ tent_id: TENT_ID, beer_price: 9.5 }),
        }),
      );

      // Answering "added" for a request that wrote nothing is the same lie as
      // answering "failed" for one that worked.
      expect(res.status).toBe(201);
      expect(mockSupabase.from).toHaveBeenCalledWith("drink_type_prices");
    });

    it("rejects a price the numeric(5,2) column cannot hold", async () => {
      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents`, {
          method: "POST",
          body: JSON.stringify({ tent_id: TENT_ID, beer_price: 1000 }),
        }),
      );

      // Without the cap this reaches Postgres as `numeric field overflow`.
      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("POST /admin/tents", () => {
    it("rejects a category tents_category_check would refuse", async () => {
      const res = await app.request(
        createAuthRequest("/admin/tents", {
          method: "POST",
          body: JSON.stringify({ name: "Festzelt", category: "Beer Gardens" }),
        }),
      );

      // The CHECK allows large/small/old only. Free text here means the first
      // category an admin types comes back as a 500.
      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("accepts one of the three the constraint allows", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: { id: TENT_ID, name: "Schottenhamel", category: "large" },
          error: null,
        }),
      );

      const res = await app.request(
        createAuthRequest("/admin/tents", {
          method: "POST",
          body: JSON.stringify({ name: "Schottenhamel", category: "large" }),
        }),
      );

      expect(res.status).toBe(201);
    });
  });

  describe("GET /admin/festivals/:festivalId/tents", () => {
    it("reads the tent list once and derives the stats from it", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: FESTIVAL_TENT_ID,
              beer_price: 9.5,
              tent: { id: TENT_ID, name: "A", category: "large" },
            },
            { id: "other", beer_price: null, tent: { id: OTHER_ID, name: "B", category: null } },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest(`/admin/festivals/${FESTIVAL_ID}/tents`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.tents).toHaveLength(2);
      expect(body.stats.total_tents).toBe(2);
      expect(body.stats.with_custom_pricing).toBe(1);
      expect(body.stats.avg_price).toBe(9.5);
      expect(body.stats.categories).toEqual({ large: 1, Uncategorized: 1 });
      // One query, not two: the stats used to refetch the same list.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(1);
    });
  });

  describe("PATCH /admin/tents/:tentId", () => {
    it("404s instead of 500ing when the tent does not exist", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "Schottenhamel" }),
        }),
      );

      expect(res.status).toBe(404);
    });

    it("reads rather than writes when the patch is empty", async () => {
      const chain = createMockChain({
        data: { id: TENT_ID, name: "Schottenhamel", category: "large" },
        error: null,
      });
      vi.mocked(mockSupabase.from).mockReturnValueOnce(chain);

      const res = await app.request(
        createAuthRequest(`/admin/tents/${TENT_ID}`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
      );

      // PostgREST rejects an update with no columns, so an empty patch has to
      // become a read. Every field on the schema is optional, so this request
      // is valid and has to answer something.
      expect(res.status).toBe(200);
      expect(chain.update).not.toHaveBeenCalled();
      expect(chain.select).toHaveBeenCalled();
    });
  });

  describe("GET /admin/wrapped-cache", () => {
    it("flattens the profile and festival embeds onto each entry", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: [
            {
              id: FESTIVAL_TENT_ID,
              user_id: OTHER_ID,
              festival_id: FESTIVAL_ID,
              generated_by: "admin",
              created_at: "2026-09-01T10:00:00Z",
              updated_at: "2026-09-19T22:44:14Z",
              user: { username: "hansi", full_name: "Hans Meier" },
              festival: { name: "Oktoberfest 2025" },
            },
          ],
          error: null,
        }),
      );

      const res = await app.request(createAuthRequest("/admin/wrapped-cache"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.entries).toEqual([
        {
          id: FESTIVAL_TENT_ID,
          user_id: OTHER_ID,
          username: "hansi",
          full_name: "Hans Meier",
          festival_id: FESTIVAL_ID,
          festival_name: "Oktoberfest 2025",
          generated_by: "admin",
          created_at: "2026-09-01T10:00:00Z",
          updated_at: "2026-09-19T22:44:14Z",
        },
      ]);
    });

    it("never selects the cached payload", async () => {
      const chain = createMockChain({ data: [], error: null });
      vi.mocked(mockSupabase.from).mockReturnValueOnce(chain);

      const res = await app.request(createAuthRequest("/admin/wrapped-cache"));

      expect(res.status).toBe(200);
      // wrapped_data is a fat jsonb blob per row and the screen shows none of
      // it; pulling it would make the list cost multiples of what it needs.
      expect(chain.select).toHaveBeenCalledWith(expect.not.stringContaining("wrapped_data"));
    });

    it("answers with an empty list rather than null when nothing is cached", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(createAuthRequest("/admin/wrapped-cache"));

      expect(res.status).toBe(200);
      expect(((await res.json()) as any).entries).toEqual([]);
    });
  });
});
