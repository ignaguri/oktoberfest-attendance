import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_CONTEXTUAL_ASK_STATE,
  parseContextualAskState,
  runContextualAskPrimary,
  withDecline,
} from "../contextual-ask";

describe("parseContextualAskState", () => {
  it("starts empty when nothing is stored", () => {
    expect(parseContextualAskState(null)).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
  });

  it("reads a stored state", () => {
    const raw = JSON.stringify({ declineCount: 2, lastDeclinedAt: "2026-09-10T08:00:00.000Z" });
    expect(parseContextualAskState(raw)).toEqual({
      declineCount: 2,
      lastDeclinedAt: "2026-09-10T08:00:00.000Z",
    });
  });

  it("falls back to empty for corrupt or wrongly shaped values", () => {
    expect(parseContextualAskState("not json")).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
    expect(parseContextualAskState("[]")).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
    expect(
      parseContextualAskState(JSON.stringify({ declineCount: -1, lastDeclinedAt: null })),
    ).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
    expect(
      parseContextualAskState(JSON.stringify({ declineCount: 1.5, lastDeclinedAt: null })),
    ).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
    expect(
      parseContextualAskState(JSON.stringify({ declineCount: 1, lastDeclinedAt: "nope" })),
    ).toEqual(EMPTY_CONTEXTUAL_ASK_STATE);
  });
});

describe("withDecline", () => {
  it("counts the decline and stamps the time", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    expect(withDecline({ declineCount: 1, lastDeclinedAt: null }, now)).toEqual({
      declineCount: 2,
      lastDeclinedAt: "2026-09-20T12:00:00.000Z",
    });
  });
});

function makeDeps(overrides: Partial<Parameters<typeof runContextualAskPrimary>[0]> = {}) {
  return {
    permissionStatus: "undetermined" as const,
    requestPermission: vi.fn(async () => true),
    register: vi.fn(async () => true),
    openSettings: vi.fn(async () => {}),
    recordDecline: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runContextualAskPrimary", () => {
  it("asks the OS and registers the device when granted", async () => {
    const deps = makeDeps();
    await expect(runContextualAskPrimary(deps)).resolves.toBe("registered");
    expect(deps.requestPermission).toHaveBeenCalledOnce();
    expect(deps.register).toHaveBeenCalledOnce();
    expect(deps.recordDecline).not.toHaveBeenCalled();
    expect(deps.openSettings).not.toHaveBeenCalled();
  });

  it("records a decline when the OS prompt is refused", async () => {
    const deps = makeDeps({ requestPermission: vi.fn(async () => false) });
    await expect(runContextualAskPrimary(deps)).resolves.toBe("declined");
    expect(deps.recordDecline).toHaveBeenCalledOnce();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it("opens settings when denied, without recording a decline or asking the OS", async () => {
    const deps = makeDeps({ permissionStatus: "denied" });
    await expect(runContextualAskPrimary(deps)).resolves.toBe("opened_settings");
    expect(deps.openSettings).toHaveBeenCalledOnce();
    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(deps.recordDecline).not.toHaveBeenCalled();
  });
});
