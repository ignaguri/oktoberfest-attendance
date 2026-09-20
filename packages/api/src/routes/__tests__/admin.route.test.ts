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
});
