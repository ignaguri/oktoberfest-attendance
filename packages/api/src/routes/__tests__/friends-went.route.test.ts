import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { FriendsWentService } from "../../services/friends-went.service";
import friendsWentRoutes from "../friends-went.route";

vi.mock("../../services/friends-went.service", () => ({
  FriendsWentService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";
const DATE = "2026-09-19";

const FRIEND = {
  userId: "33333333-3333-4333-8333-333333333333",
  username: "ana",
  fullName: null,
  avatarUrl: null,
  totalDrinks: 2,
  drinks: [{ type: "beer", count: 2 }],
  tents: ["Hofbräu"],
  photoCount: 0,
  photos: [],
  sharedGroupId: null,
};

describe("Friends went route - unit", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockUser: ReturnType<typeof createMockUser>;
  let service: { getFriendsWent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    app = createTestApp();
    mockUser = createMockUser();
    const mockSupabase = createMockSupabase();

    service = { getFriendsWent: vi.fn() };
    vi.mocked(FriendsWentService).mockImplementation(function () {
      return service as any;
    });

    app.use("*", async (c, next) => {
      if (!c.req.header("Authorization")) {
        return c.json({ error: "Unauthorized", message: "Missing authorization header" }, 401);
      }
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    app.route("/", friendsWentRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists friends who went on a day", async () => {
    service.getFriendsWent.mockResolvedValueOnce([FRIEND]);

    const res = await app.request(
      createAuthRequest(`/attendance/friends-went?festivalId=${FESTIVAL_ID}&date=${DATE}`),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ friends: [FRIEND] });
    expect(service.getFriendsWent).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID, DATE);
  });

  it("rejects a malformed date", async () => {
    const res = await app.request(
      createAuthRequest(`/attendance/friends-went?festivalId=${FESTIVAL_ID}&date=19-09-2026`),
    );

    expect(res.status).toBe(400);
    expect(service.getFriendsWent).not.toHaveBeenCalled();
  });

  it("rejects a missing festival id", async () => {
    const res = await app.request(createAuthRequest(`/attendance/friends-went?date=${DATE}`));

    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await app.request(
      `http://localhost/attendance/friends-went?festivalId=${FESTIVAL_ID}&date=${DATE}`,
    );

    expect(res.status).toBe(401);
  });
});
