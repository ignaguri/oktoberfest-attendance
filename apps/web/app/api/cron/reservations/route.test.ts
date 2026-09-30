import { afterEach, describe, expect, it, vi } from "vitest";

const processReservationNotifications = vi.fn().mockResolvedValue(undefined);

vi.mock("../scheduler/reservations", () => ({
  processReservationNotifications: (...args: unknown[]) => processReservationNotifications(...args),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/notifications", () => ({
  createNotificationService: vi.fn(() => ({})),
}));

describe("reservations cron route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("runs the reservation job when x-cron-secret matches CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/cron/reservations", {
        method: "POST",
        headers: { "x-cron-secret": "test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(processReservationNotifications).toHaveBeenCalledTimes(1);
  });

  it("returns 401 and runs nothing when the secret is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/cron/reservations", {
        method: "POST",
        headers: { "x-cron-secret": "wrong-secret" },
      }),
    );

    expect(res.status).toBe(401);
    expect(processReservationNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("./route");

    const res = await POST(
      new Request("http://localhost/api/cron/reservations", {
        method: "POST",
        headers: { "x-cron-secret": "" },
      }),
    );

    expect(res.status).toBe(401);
    expect(processReservationNotifications).not.toHaveBeenCalled();
  });
});
