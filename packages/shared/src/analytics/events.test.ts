import { describe, expect, it } from "vitest";

import {
  EVENT_NAMES,
  MAX_EVENT_PROPS_CHARS,
  parseTrackedEvent,
  RecordEventsBodySchema,
  toEventCode,
  type TrackedEvent,
} from "./events";

const SESSION = "6f1c2f5e-2b8a-4f7e-9d0a-1c2b3d4e5f60";

function event(overrides: Partial<TrackedEvent>): TrackedEvent {
  return {
    name: "screen_viewed",
    props: { screen: "/home" },
    occurredAt: "2026-09-28T10:00:00.000Z",
    sessionId: SESSION,
    ...overrides,
  };
}

describe("parseTrackedEvent", () => {
  it("accepts a known event with valid props", () => {
    expect(parseTrackedEvent(event({}))).toEqual({
      name: "screen_viewed",
      props: { screen: "/home" },
    });
  });

  it("rejects an unknown name, including prototype keys", () => {
    expect(parseTrackedEvent(event({ name: "made_up" }))).toBeNull();
    expect(parseTrackedEvent(event({ name: "toString" }))).toBeNull();
  });

  it("rejects props that fail the event schema or carry extra keys", () => {
    expect(parseTrackedEvent(event({ props: { screen: "home" } }))).toBeNull();
    expect(parseTrackedEvent(event({ props: { screen: "/home", email: "a@b.c" } }))).toBeNull();
  });

  it("rejects oversized props", () => {
    const huge = "/" + "a".repeat(MAX_EVENT_PROPS_CHARS);
    expect(parseTrackedEvent(event({ props: { screen: huge } }))).toBeNull();
  });

  it("validates missing props instead of skipping validation", () => {
    expect(parseTrackedEvent(event({ name: "screen_viewed", props: undefined }))).toBeNull();
  });

  it("knows every event in the spec", () => {
    expect([...EVENT_NAMES].sort()).toEqual(
      [
        "app_opened",
        "empty_state_seen",
        "error_shown",
        "notification_opened",
        "prompt_answered",
        "screen_viewed",
        "sheet_abandoned",
        "sheet_opened",
        "tutorial_step",
      ].sort(),
    );
  });
});

describe("RecordEventsBodySchema", () => {
  it("rejects an empty batch and a batch over 50", () => {
    expect(RecordEventsBodySchema.safeParse({ events: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 51 }, () => event({}));
    expect(RecordEventsBodySchema.safeParse({ events: tooMany }).success).toBe(false);
  });

  it("strips a user_id smuggled into an event", () => {
    const parsed = RecordEventsBodySchema.parse({
      events: [{ ...event({}), user_id: "someone-else" }],
    });
    expect(parsed.events[0]).not.toHaveProperty("user_id");
  });
});

describe("toEventCode", () => {
  it("upper-snakes and bounds any value", () => {
    expect(toEventCode("not-found")).toBe("NOT_FOUND");
    expect(toEventCode(undefined)).toBe("UNKNOWN");
    expect(toEventCode("x".repeat(80))).toHaveLength(40);
  });
});
