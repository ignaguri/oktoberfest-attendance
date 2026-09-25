import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  },
}));

import { filterUnpromptedTents, recordCrowdPrompted } from "../prompt-memory";

describe("crowd prompt memory", () => {
  beforeEach(() => {
    store.clear();
  });

  it("skips a tent already prompted that day", async () => {
    await recordCrowdPrompted(["tent-a"], "2026-09-24");

    await expect(filterUnpromptedTents(["tent-a", "tent-b"], "2026-09-24")).resolves.toEqual([
      "tent-b",
    ]);
  });

  it("prompts again for the same tent on a new day", async () => {
    await recordCrowdPrompted(["tent-a"], "2026-09-24");

    await expect(filterUnpromptedTents(["tent-a"], "2026-09-25")).resolves.toEqual(["tent-a"]);
  });

  it("keeps earlier tents of the same day when recording another", async () => {
    await recordCrowdPrompted(["tent-a"], "2026-09-24");
    await recordCrowdPrompted(["tent-b"], "2026-09-24");

    await expect(filterUnpromptedTents(["tent-a", "tent-b"], "2026-09-24")).resolves.toEqual([]);
  });

  it("treats a corrupt stored value as nothing prompted", async () => {
    store.set("@prostcounter/crowd-prompt/prompted", "{oops");

    await expect(filterUnpromptedTents(["tent-a"], "2026-09-24")).resolves.toEqual(["tent-a"]);
  });
});
