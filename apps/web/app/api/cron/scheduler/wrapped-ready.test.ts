import { afterEach, describe, expect, it, vi } from "vitest";

async function createServiceWithTriggerBulk(triggerBulk: ReturnType<typeof vi.fn>) {
  vi.stubEnv("NOVU_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  const { NotificationService } = await import("@/lib/services/notifications");
  const service = new NotificationService();
  (service.novu as unknown as { triggerBulk: typeof triggerBulk }).triggerBulk = triggerBulk;
  return service;
}

describe("NotificationService.notifyWrappedReady", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bulk-triggers in chunks of 100 with a stable per-user transactionId", async () => {
    const triggerBulk = vi.fn().mockResolvedValue({});
    const service = await createServiceWithTriggerBulk(triggerBulk);
    const recipientIds = Array.from({ length: 150 }, (_, index) => `user-${index}`);

    await service.notifyWrappedReady(recipientIds, { id: "fest-1", name: "Oktoberfest 2026" });

    expect(triggerBulk).toHaveBeenCalledTimes(2);
    expect(triggerBulk.mock.calls[0][0].events).toHaveLength(100);
    expect(triggerBulk.mock.calls[1][0].events).toHaveLength(50);
    expect(triggerBulk.mock.calls[0][0].events[0]).toMatchObject({
      workflowId: "wrapped-ready",
      to: "user-0",
      transactionId: "wrapped-ready:fest-1:user-0",
      payload: {
        type: "wrapped-ready",
        festivalId: "fest-1",
        festivalName: "Oktoberfest 2026",
        title: "Your Oktoberfest 2026 Wrapped is here 🍻",
      },
    });
  });

  it("attempts every chunk even when an earlier one fails, then rejects", async () => {
    const triggerBulk = vi
      .fn()
      .mockRejectedValueOnce(new Error("novu unavailable"))
      .mockResolvedValueOnce({});
    const service = await createServiceWithTriggerBulk(triggerBulk);
    const recipientIds = Array.from({ length: 150 }, (_, index) => `user-${index}`);

    await expect(
      service.notifyWrappedReady(recipientIds, { id: "fest-1", name: "Oktoberfest 2026" }),
    ).rejects.toThrow();
    expect(triggerBulk).toHaveBeenCalledTimes(2);
  });
});
