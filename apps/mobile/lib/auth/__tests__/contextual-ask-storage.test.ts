import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import { getContextualAskState, recordContextualAskDecline } from "../secure-storage";

describe("contextual ask storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("reads an empty state for a user who was never asked", async () => {
    await expect(getContextualAskState("user-1")).resolves.toEqual({
      declineCount: 0,
      lastDeclinedAt: null,
    });
  });

  it("counts declines per user", async () => {
    await recordContextualAskDecline("user-1", new Date("2026-09-10T08:00:00.000Z"));
    await recordContextualAskDecline("user-1", new Date("2026-09-18T08:00:00.000Z"));

    await expect(getContextualAskState("user-1")).resolves.toEqual({
      declineCount: 2,
      lastDeclinedAt: "2026-09-18T08:00:00.000Z",
    });
    await expect(getContextualAskState("user-2")).resolves.toEqual({
      declineCount: 0,
      lastDeclinedAt: null,
    });
  });

  it("recovers from a corrupt stored value", async () => {
    store.set("prostcounter_contextual_notification_ask_v1_user-1", "{oops");
    await recordContextualAskDecline("user-1", new Date("2026-09-18T08:00:00.000Z"));

    await expect(getContextualAskState("user-1")).resolves.toEqual({
      declineCount: 1,
      lastDeclinedAt: "2026-09-18T08:00:00.000Z",
    });
  });
});
