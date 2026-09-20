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
              },
              {
                tent_id: "66666666-6666-4666-8666-666666666666",
                visit_date: "2026-09-21T10:00:00Z",
              },
            ],
            error: null,
          }),
        );

      const res = await app.request(createAuthRequest(`/admin/users/${OTHER_ID}/attendances`));

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      // Only the visit on 2026-09-20 belongs to this attendance, even though it
      // was logged at 21:00 -- the timestamp is matched on its day part.
      expect(body.attendances[0].tent_ids).toEqual(["55555555-5555-4555-8555-555555555555"]);
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
        createMockChain({ data: null, error: null }),
      );

      const res = await app.request(
        createAuthRequest(`/admin/groups/${GROUP_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("groups");
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

    it("deletes when nothing references the festival", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: null }));

      const res = await app.request(
        createAuthRequest(`/admin/festivals/${FESTIVAL_ID}`, { method: "DELETE" }),
      );

      expect(res.status).toBe(200);
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

    it("clears the current active festival before inserting an active one", async () => {
      vi.mocked(mockSupabase.from)
        .mockReturnValueOnce(createMockChain({ data: null, error: null }))
        .mockReturnValueOnce(
          createMockChain({
            data: {
              id: FESTIVAL_ID,
              name: "New Fest",
              short_name: "NF",
              festival_type: "other",
              location: "Munich",
              start_date: "2026-09-19",
              end_date: "2026-09-20",
              map_url: null,
              timezone: "Europe/Berlin",
              is_active: true,
              status: "upcoming",
              description: null,
              beer_cost: null,
              created_at: "2026-09-19T00:00:00Z",
              updated_at: "2026-09-19T00:00:00Z",
            },
            error: null,
          }),
        );

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
      // Two calls: the deactivate sweep, then the insert. Without the sweep the
      // unique partial index on is_active rejects the insert.
      expect(vi.mocked(mockSupabase.from).mock.calls.length).toBe(2);
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
});
