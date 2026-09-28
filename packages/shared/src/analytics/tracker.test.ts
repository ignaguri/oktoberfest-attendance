import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrackedEvent } from "./events";
import {
  createTracker,
  FLUSH_AT_SIZE,
  FLUSH_INTERVAL_MS,
  MAX_QUEUE,
  NOOP_TRACKER,
  SESSION_IDLE_MS,
  type SendEvents,
} from "./tracker";

const runNow = (run: () => void) => run();

async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function setup(send: SendEvents = vi.fn().mockResolvedValue(undefined)) {
  let clock = new Date("2026-09-28T10:00:00.000Z");
  let sessionCounter = 0;
  const tracker = createTracker({
    send,
    createSessionId: () => `00000000-0000-4000-8000-00000000000${sessionCounter++}`,
    now: () => clock,
    schedule: runNow,
  });
  return {
    tracker,
    send: send as ReturnType<typeof vi.fn>,
    advance(ms: number) {
      clock = new Date(clock.getTime() + ms);
    },
  };
}

function sentBatches(send: ReturnType<typeof vi.fn>): TrackedEvent[][] {
  return send.mock.calls.map((call) => call[0] as TrackedEvent[]);
}

describe("createTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns synchronously and does not send below the size threshold", () => {
    const { tracker, send } = setup();
    const result = tracker.track("screen_viewed", { screen: "/home" });
    expect(result).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("flushes when the queue reaches FLUSH_AT_SIZE", () => {
    const { tracker, send } = setup();
    for (let i = 0; i < FLUSH_AT_SIZE; i++) {
      tracker.track("screen_viewed", { screen: "/home" });
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentBatches(send)[0]).toHaveLength(FLUSH_AT_SIZE);
  });

  it("flushes on the interval", async () => {
    const { tracker, send } = setup();
    tracker.track("app_opened", { source: "cold" });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stamps occurredAt and the session id", () => {
    const { tracker, send } = setup();
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    expect(sentBatches(send)[0][0]).toEqual({
      name: "app_opened",
      props: { source: "cold" },
      occurredAt: "2026-09-28T10:00:00.000Z",
      sessionId: "00000000-0000-4000-8000-000000000000",
    });
  });

  it("drops invalid props instead of throwing", () => {
    const { tracker, send } = setup();
    expect(() =>
      tracker.track("screen_viewed", { screen: "no-leading-slash" } as never),
    ).not.toThrow();
    tracker.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("never throws when send throws synchronously", async () => {
    const send = vi.fn(() => {
      throw new Error("boom");
    }) as unknown as SendEvents;
    const { tracker } = setup(send);
    tracker.track("app_opened", { source: "cold" });
    expect(() => tracker.flush()).not.toThrow();
    await settle();
  });

  it("retries a failed batch once with the next flush", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { tracker } = setup(send);
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    await settle();
    tracker.track("app_opened", { source: "resume" });
    tracker.flush();
    await settle();
    const second = sentBatches(send)[1];
    expect(second.map((e) => e.props?.source)).toEqual(["cold", "resume"]);
  });

  it("drops a batch after its single retry fails", async () => {
    // The server answered (401: token expired or signed out)
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("401"), { statusCode: 401 }));
    const { tracker } = setup(send);
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    await settle();
    tracker.flush();
    await settle();
    tracker.flush();
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps events queued through a long offline stretch", async () => {
    const offline = new TypeError("Network request failed");
    const send = vi.fn();
    for (let i = 0; i < 10; i++) {
      send.mockRejectedValueOnce(offline);
    }
    send.mockResolvedValue(undefined);
    const { tracker } = setup(send);
    tracker.track("app_opened", { source: "cold" });
    for (let i = 0; i < 10; i++) {
      tracker.flush();
      await settle();
    }
    tracker.track("app_opened", { source: "resume" });
    tracker.flush();
    await settle();
    expect(
      sentBatches(send)
        .at(-1)
        ?.map((e) => e.props?.source),
    ).toEqual(["cold", "resume"]);
  });

  it("caps the queue at 200 while offline, dropping the oldest", async () => {
    const send = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    const { tracker } = setup(send);
    for (let i = 0; i < MAX_QUEUE + 50; i++) {
      tracker.track("tutorial_step", { step: `s${i}`, action: "viewed" });
      await settle();
    }
    const internal = (tracker as unknown as { queueSize(): number }).queueSize();
    expect(internal).toBe(MAX_QUEUE);
    send.mockResolvedValue(undefined);
    tracker.flush();
    await settle();
    expect(sentBatches(send).at(-1)?.[0].props?.step).toBe("s50");
  });

  it("ignores a flush while one is in flight", async () => {
    let resolveSend: () => void = () => {};
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const { tracker } = setup(send);
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    tracker.flush();
    expect(send).toHaveBeenCalledTimes(1);
    resolveSend();
    await settle();
  });

  it("caps the queue at 200, dropping the oldest", () => {
    const send = vi.fn().mockReturnValue(new Promise(() => {}));
    const { tracker } = setup(send);
    // The first 20 go out in a batch that never settles, so the rest pile up.
    for (let i = 0; i < FLUSH_AT_SIZE + MAX_QUEUE + 5; i++) {
      tracker.track("tutorial_step", { step: `s${i}`, action: "viewed" });
    }
    expect(send).toHaveBeenCalledTimes(1);
    // Nothing else is observable without flushing, so check through dispose-free access:
    const internal = (tracker as unknown as { queueSize(): number }).queueSize();
    expect(internal).toBe(MAX_QUEUE);
  });

  it("sends at most 50 events per batch", async () => {
    let releaseFirstSend: () => void = () => {};
    const send = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstSend = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const { tracker } = setup(send);
    // The first 20 go out and hang; the next 100 queue up behind them.
    for (let i = 0; i < FLUSH_AT_SIZE + 100; i++) {
      tracker.track("app_opened", { source: "cold" });
    }
    releaseFirstSend();
    await settle();
    tracker.flush();
    expect(sentBatches(send)[1]).toHaveLength(50);
  });

  it("runs keepalive flushes immediately, bypassing the scheduler", () => {
    const schedule = vi.fn();
    const send = vi.fn().mockResolvedValue(undefined);
    const tracker = createTracker({
      send,
      createSessionId: () => "00000000-0000-4000-8000-000000000000",
      schedule,
    });
    tracker.track("app_opened", { source: "cold" });
    tracker.flush({ keepalive: true });
    expect(schedule).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.any(Array), { keepalive: true });
  });

  it("keepalive takes over a flush still waiting for its idle slot", () => {
    const pendingRuns: (() => void)[] = [];
    const send = vi.fn().mockResolvedValue(undefined);
    const tracker = createTracker({
      send,
      createSessionId: () => "00000000-0000-4000-8000-000000000000",
      schedule: (run) => {
        pendingRuns.push(run);
      },
    });
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    tracker.flush({ keepalive: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([expect.objectContaining({ name: "app_opened" })], {
      keepalive: true,
    });
    // The idle slot arriving later must not send a second (empty or duplicate) batch.
    pendingRuns.forEach((run) => run());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keepalive sends what queued behind a send still in flight", () => {
    const send = vi
      .fn()
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue(undefined);
    const { tracker } = setup(send);
    for (let i = 0; i < FLUSH_AT_SIZE; i++) {
      tracker.track("app_opened", { source: "cold" });
    }
    tracker.track("screen_viewed", { screen: "/home" });
    tracker.flush({ keepalive: true });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith([expect.objectContaining({ name: "screen_viewed" })], {
      keepalive: true,
    });
  });

  it("pause flushes with keepalive", () => {
    const { tracker, send } = setup();
    tracker.track("app_opened", { source: "cold" });
    tracker.pause();
    expect(send).toHaveBeenCalledWith(expect.any(Array), { keepalive: true });
  });

  it("starts a new session only after SESSION_IDLE_MS paused", () => {
    const { tracker, send, advance } = setup();
    tracker.pause();
    advance(SESSION_IDLE_MS - 1);
    expect(tracker.resume()).toBe(false);
    tracker.pause();
    advance(SESSION_IDLE_MS);
    expect(tracker.resume()).toBe(true);
    tracker.track("app_opened", { source: "resume" });
    tracker.flush();
    expect(sentBatches(send).at(-1)?.[0].sessionId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("dispose drops the queue and stops the timer", async () => {
    const { tracker, send } = setup();
    tracker.track("app_opened", { source: "cold" });
    tracker.dispose();
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2);
    tracker.track("app_opened", { source: "cold" });
    tracker.flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("NOOP_TRACKER", () => {
  it("does nothing", () => {
    expect(() => NOOP_TRACKER.track("app_opened", { source: "cold" })).not.toThrow();
    expect(NOOP_TRACKER.resume()).toBe(false);
  });
});
