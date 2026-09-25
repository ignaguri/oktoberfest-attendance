import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { DayPlanService } from "../../services/day-plan.service";
import dayPlanRoutes from "../day-plan.route";

vi.mock("../../services/day-plan.service", () => ({
  DayPlanService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const { notifyPlanOverlapMock } = vi.hoisted(() => ({ notifyPlanOverlapMock: vi.fn() }));

vi.mock("../../services/notification.service", () => {
  const mocked = {
    NotificationService: vi.fn().mockImplementation(function () {
      return { notifyPlanOverlap: notifyPlanOverlapMock };
    }),
  };
  return {
    ...mocked,
    createNotificationService: () =>
      process.env.NOVU_API_KEY ? new mocked.NotificationService() : null,
  };
});

const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";
const DATE = "2026-09-26";

const PLAN = {
  id: "44444444-4444-4444-8444-444444444444",
  userId: "11111111-1111-4111-8111-111111111111",
  festivalId: FESTIVAL_ID,
  date: DATE,
  kind: "plan",
  tentId: null,
  tentName: null,
  note: "with the crew",
  visibleToGroups: true,
  companions: { users: [], groups: [] },
  startAt: null,
  endAt: null,
  status: null,
  reminderOffsetMinutes: null,
  autoCheckin: null,
  reminderSentAt: null,
  promptSentAt: null,
  processedAt: null,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: null,
};

describe("Day plan routes - unit", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockUser: ReturnType<typeof createMockUser>;
  let service: {
    listPlans: ReturnType<typeof vi.fn>;
    upsertPlan: ReturnType<typeof vi.fn>;
    removePlan: ReturnType<typeof vi.fn>;
    getFriendsGoing: ReturnType<typeof vi.fn>;
    getCompanionOptions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockUser = createMockUser();
    const mockSupabase = createMockSupabase();

    service = {
      listPlans: vi.fn(),
      upsertPlan: vi.fn(),
      removePlan: vi.fn(),
      getFriendsGoing: vi.fn(),
      getCompanionOptions: vi.fn(),
    };
    vi.mocked(DayPlanService).mockImplementation(function () {
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

    app.route("/", dayPlanRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists the user's plans for a festival", async () => {
    service.listPlans.mockResolvedValueOnce([PLAN]);

    const res = await app.request(createAuthRequest(`/festivals/${FESTIVAL_ID}/plans`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plans: [PLAN] });
    expect(service.listPlans).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID);
  });

  it("saves a plan for a day", async () => {
    service.upsertPlan.mockResolvedValueOnce({
      plan: PLAN,
      becameVisible: false,
      today: "2026-09-20",
    });
    const body = { kind: "plan", visibleToGroups: true, note: "with the crew" };

    const res = await app.request(
      createAuthRequest(`/festivals/${FESTIVAL_ID}/days/${DATE}/plan`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plan: PLAN });
    expect(service.upsertPlan).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID, DATE, body);
  });

  describe("overlap push", () => {
    const originalNovuKey = process.env.NOVU_API_KEY;

    beforeEach(() => {
      process.env.NOVU_API_KEY = "test-novu-key";
    });

    afterEach(() => {
      process.env.NOVU_API_KEY = originalNovuKey;
    });

    function putPlan() {
      return app.request(
        createAuthRequest(`/festivals/${FESTIVAL_ID}/days/${DATE}/plan`, {
          method: "PUT",
          body: JSON.stringify({ kind: "plan", visibleToGroups: true }),
        }),
      );
    }

    it("notifies overlapping friends when the day became visible", async () => {
      service.upsertPlan.mockResolvedValueOnce({
        plan: PLAN,
        becameVisible: true,
        today: "2026-09-20",
      });

      const res = await putPlan();

      expect(res.status).toBe(200);
      expect(notifyPlanOverlapMock).toHaveBeenCalledWith({
        actorId: mockUser.id,
        festivalId: FESTIVAL_ID,
        date: DATE,
        today: "2026-09-20",
        kind: "plan",
        tentName: null,
      });
    });

    it("stays quiet when the save did not change visibility", async () => {
      service.upsertPlan.mockResolvedValueOnce({
        plan: PLAN,
        becameVisible: false,
        today: "2026-09-20",
      });

      await putPlan();

      expect(notifyPlanOverlapMock).not.toHaveBeenCalled();
    });

    it("still saves when the notification throws", async () => {
      service.upsertPlan.mockResolvedValueOnce({
        plan: PLAN,
        becameVisible: true,
        today: "2026-09-20",
      });
      notifyPlanOverlapMock.mockRejectedValueOnce(new Error("novu down"));

      const res = await putPlan();

      expect(res.status).toBe(200);
    });
  });

  it("rejects a reservation without a tent", async () => {
    const res = await app.request(
      createAuthRequest(`/festivals/${FESTIVAL_ID}/days/${DATE}/plan`, {
        method: "PUT",
        body: JSON.stringify({
          kind: "reservation",
          startAt: "2026-09-26T14:00:00.000Z",
          visibleToGroups: true,
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(service.upsertPlan).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const res = await app.request(
      createAuthRequest(`/festivals/${FESTIVAL_ID}/days/26-09-2026/plan`, {
        method: "PUT",
        body: JSON.stringify({ kind: "plan", visibleToGroups: true }),
      }),
    );

    expect(res.status).toBe(400);
    expect(service.upsertPlan).not.toHaveBeenCalled();
  });

  it("removes a day's plan", async () => {
    service.removePlan.mockResolvedValueOnce(undefined);

    const res = await app.request(
      createAuthRequest(`/festivals/${FESTIVAL_ID}/days/${DATE}/plan`, { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(service.removePlan).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID, DATE);
  });

  it("returns friends going from today on", async () => {
    const days = [
      {
        date: DATE,
        users: [
          {
            userId: "55555555-5555-4555-8555-555555555555",
            username: "ana",
            fullName: null,
            avatarUrl: null,
            kind: "reservation",
            tentName: "Augustiner-Festhalle",
            startAt: "2026-09-26T09:00:00.000Z",
            note: null,
            companions: { users: [], groups: [] },
          },
        ],
      },
    ];
    service.getFriendsGoing.mockResolvedValueOnce(days);

    const res = await app.request(createAuthRequest(`/festivals/${FESTIVAL_ID}/friends-going`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ days });
    expect(service.getFriendsGoing).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID);
  });

  it("returns who the user can tag on a plan", async () => {
    const options = {
      users: [
        {
          userId: "55555555-5555-4555-8555-555555555555",
          username: "ana",
          fullName: null,
          avatarUrl: null,
        },
      ],
      groups: [{ groupId: "66666666-6666-4666-8666-666666666666", name: "Office" }],
    };
    service.getCompanionOptions.mockResolvedValueOnce(options);

    const res = await app.request(createAuthRequest(`/festivals/${FESTIVAL_ID}/plan-companions`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(options);
    expect(service.getCompanionOptions).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID);
  });

  it("requires authentication", async () => {
    const res = await app.request(`http://localhost/festivals/${FESTIVAL_ID}/plans`);

    expect(res.status).toBe(401);
  });
});
