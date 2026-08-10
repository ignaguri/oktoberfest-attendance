// Unit test for markUnlocksSeen's silent-no-op guard.
//
// This lives apart from pending-unlocks.integration.test.ts on purpose: a
// correctly configured database can no longer produce the failure being tested.
// The guard exists for the case where the UPDATE is filtered away by RLS or a
// missing column grant, which is exactly what shipped in Plan 5 and stayed
// invisible because the repository reported the no-op as an ordinary short ack.
// Reproducing that needs a stubbed client, not a real one.
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { AchievementMetricsRepository } from "../achievement-metrics.repository";

type StubRow = { id: string };

/**
 * Minimal stand-in for the two chains markUnlocksSeen builds: an update that
 * resolves to `updateResult`, and a verifying select that resolves to
 * `selectResult`. Every builder method returns `this` so the call order in the
 * repository does not matter.
 */
function createStubClient(updateResult: StubRow[], selectResult: StubRow[]) {
  const selectChain = {
    eq: () => selectChain,
    in: () => selectChain,
    is: () => Promise.resolve({ data: selectResult, error: null }),
  };

  const updateChain = {
    eq: () => updateChain,
    in: () => updateChain,
    is: () => updateChain,
    select: () => Promise.resolve({ data: updateResult, error: null }),
  };

  const from = vi.fn(() => ({
    update: () => updateChain,
    select: () => selectChain,
  }));

  return { from } as unknown as SupabaseClient<Database>;
}

describe("markUnlocksSeen", () => {
  it("throws when the write silently matched nothing and the rows are still pending", async () => {
    // The shape of the original bug: the update returns no rows, yet a plain
    // select still sees them as ours and un-acked.
    const repo = new AchievementMetricsRepository(
      createStubClient([], [{ id: "event-1" }, { id: "event-2" }]),
    );

    await expect(repo.markUnlocksSeen("user-1", ["event-1", "event-2"])).rejects.toThrow(
      /2 of 2 events remain unacknowledged/,
    );
  });

  it("throws on a partial write that leaves a row pending", async () => {
    const repo = new AchievementMetricsRepository(
      createStubClient([{ id: "event-1" }], [{ id: "event-2" }]),
    );

    await expect(repo.markUnlocksSeen("user-1", ["event-1", "event-2"])).rejects.toThrow(
      /1 of 2 events remain unacknowledged/,
    );
  });

  it("treats a short ack with nothing left pending as ordinary idempotency", async () => {
    // Re-sending ids that are already stamped, or that belong to someone else,
    // legitimately acks zero. Nothing is left pending for this user, so it must
    // not raise — the client re-sends on every batch and would otherwise 500 on
    // a duplicate.
    const repo = new AchievementMetricsRepository(createStubClient([], []));

    await expect(repo.markUnlocksSeen("user-1", ["event-1"])).resolves.toBe(0);
  });

  it("returns the count without verifying when every requested event was acked", async () => {
    const stub = createStubClient([{ id: "event-1" }, { id: "event-2" }], []);
    const repo = new AchievementMetricsRepository(stub);

    await expect(repo.markUnlocksSeen("user-1", ["event-1", "event-2"])).resolves.toBe(2);
    // One call for the update, none for the verifying select: the happy path
    // must not pay for the guard.
    expect(stub.from).toHaveBeenCalledTimes(1);
  });

  it("short-circuits an empty request without touching the database", async () => {
    const stub = createStubClient([], []);
    const repo = new AchievementMetricsRepository(stub);

    await expect(repo.markUnlocksSeen("user-1", [])).resolves.toBe(0);
    expect(stub.from).not.toHaveBeenCalled();
  });
});
