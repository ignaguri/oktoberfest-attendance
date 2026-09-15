import { afterEach, describe, expect, it, vi } from "vitest";

const processReservationNotifications = vi.fn().mockResolvedValue(undefined);
const processAchievementNotifications = vi.fn().mockResolvedValue(undefined);
const processFestivalOpeningNotifications = vi.fn().mockResolvedValue(undefined);

vi.mock("./reservations", () => ({
  processReservationNotifications: (...args: unknown[]) => processReservationNotifications(...args),
}));
vi.mock("./achievements", () => ({
  processAchievementNotifications: (...args: unknown[]) => processAchievementNotifications(...args),
}));
vi.mock("./festival-opening", () => ({
  processFestivalOpeningNotifications: (...args: unknown[]) =>
    processFestivalOpeningNotifications(...args),
}));

const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSupabase = { from, rpc };

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock("@/lib/services/notifications", () => ({
  createNotificationService: vi.fn(() => ({})),
}));

describe("cron scheduler route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe("GET", () => {
    it("runs all jobs and returns 200 when the Bearer token matches CRON_SECRET", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { GET } = await import("./route");

      const res = await GET(
        new Request("http://localhost/api/cron/scheduler", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(res.status).toBe(200);
      expect(processReservationNotifications).toHaveBeenCalledTimes(1);
      expect(processAchievementNotifications).toHaveBeenCalledTimes(1);
      expect(processFestivalOpeningNotifications).toHaveBeenCalledTimes(1);
    });

    it("returns 401 and runs no jobs when no authorization header is sent", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { GET } = await import("./route");

      const res = await GET(new Request("http://localhost/api/cron/scheduler"));

      expect(res.status).toBe(401);
      expect(processReservationNotifications).not.toHaveBeenCalled();
      expect(processAchievementNotifications).not.toHaveBeenCalled();
      expect(processFestivalOpeningNotifications).not.toHaveBeenCalled();
    });

    it("returns 401 when the Bearer token is wrong", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { GET } = await import("./route");

      const res = await GET(
        new Request("http://localhost/api/cron/scheduler", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
      );

      expect(res.status).toBe(401);
      expect(processReservationNotifications).not.toHaveBeenCalled();
    });

    it("returns 401 when only the x-cron-secret header is sent (no Bearer)", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { GET } = await import("./route");

      const res = await GET(
        new Request("http://localhost/api/cron/scheduler", {
          headers: { "x-cron-secret": "test-secret" },
        }),
      );

      expect(res.status).toBe(401);
      expect(processReservationNotifications).not.toHaveBeenCalled();
    });

    it("returns 401 when CRON_SECRET is unset, even with an Authorization header", async () => {
      vi.stubEnv("CRON_SECRET", "");
      const { GET } = await import("./route");

      const res = await GET(
        new Request("http://localhost/api/cron/scheduler", {
          headers: { authorization: "Bearer undefined" },
        }),
      );

      expect(res.status).toBe(401);
      expect(processReservationNotifications).not.toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    it("runs all jobs and returns 200 when x-cron-secret matches CRON_SECRET", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { POST } = await import("./route");

      const res = await POST(
        new Request("http://localhost/api/cron/scheduler", {
          method: "POST",
          headers: { "x-cron-secret": "test-secret" },
        }),
      );

      expect(res.status).toBe(200);
      expect(processReservationNotifications).toHaveBeenCalledTimes(1);
      expect(processAchievementNotifications).toHaveBeenCalledTimes(1);
      expect(processFestivalOpeningNotifications).toHaveBeenCalledTimes(1);
    });

    it("returns 401 when x-cron-secret is wrong", async () => {
      vi.stubEnv("CRON_SECRET", "test-secret");
      const { POST } = await import("./route");

      const res = await POST(
        new Request("http://localhost/api/cron/scheduler", {
          method: "POST",
          headers: { "x-cron-secret": "wrong-secret" },
        }),
      );

      expect(res.status).toBe(401);
      expect(processReservationNotifications).not.toHaveBeenCalled();
    });
  });
});
