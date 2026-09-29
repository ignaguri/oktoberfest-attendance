import type { TrackedEvent } from "@prostcounter/shared";
import { describe, expect, it } from "vitest";

import { clampOccurredAt, MAX_EVENT_AGE_MS, prepareEvents } from "../event-ingest";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const SESSION = "6f1c2f5e-2b8a-4f7e-9d0a-1c2b3d4e5f60";

function event(overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    name: "screen_viewed",
    props: { screen: "/home" },
    occurredAt: "2026-09-28T11:59:00.000Z",
    sessionId: SESSION,
    ...overrides,
  };
}

describe("clampOccurredAt", () => {
  it("keeps a recent timestamp", () => {
    expect(clampOccurredAt("2026-09-28T11:00:00.000Z", NOW)).toBe("2026-09-28T11:00:00.000Z");
  });

  it("clamps a far-past/far-future occurredAt", () => {
    expect(clampOccurredAt("2020-01-01T00:00:00.000Z", NOW)).toBe(
      new Date(NOW.getTime() - MAX_EVENT_AGE_MS).toISOString(),
    );
    expect(clampOccurredAt("2030-01-01T00:00:00.000Z", NOW)).toBe(NOW.toISOString());
  });

  it("rejects an unparseable timestamp", () => {
    expect(clampOccurredAt("yesterday", NOW)).toBeNull();
  });
});

describe("prepareEvents", () => {
  it("maps valid events to insert rows", () => {
    expect(prepareEvents([event()], NOW)).toEqual([
      {
        name: "screen_viewed",
        props: { screen: "/home" },
        occurred_at: "2026-09-28T11:59:00.000Z",
        session_id: SESSION,
      },
    ]);
  });

  it("drops unknown, invalid and undatable events but keeps the rest", () => {
    const prepared = prepareEvents(
      [
        event({ name: "nope" }),
        event({ props: { screen: "/home", extra: 1 } }),
        event({ occurredAt: "garbage" }),
        event({ name: "app_opened", props: { source: "cold" } }),
      ],
      NOW,
    );
    expect(prepared.map((row) => row.name)).toEqual(["app_opened"]);
  });
});
