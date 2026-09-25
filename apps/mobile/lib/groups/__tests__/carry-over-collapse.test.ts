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

import { isCarryOverCollapsed, setCarryOverCollapsed } from "../carry-over-collapse";

describe("carry-over card collapse memory", () => {
  beforeEach(() => {
    store.clear();
  });

  it("starts expanded", async () => {
    await expect(isCarryOverCollapsed("wiesn-2026")).resolves.toBe(false);
  });

  it("remembers a collapse for that festival only", async () => {
    await setCarryOverCollapsed("wiesn-2026", true);

    await expect(isCarryOverCollapsed("wiesn-2026")).resolves.toBe(true);
    await expect(isCarryOverCollapsed("fruehlingsfest-2027")).resolves.toBe(false);
  });

  it("reopens when expanded again", async () => {
    await setCarryOverCollapsed("wiesn-2026", true);
    await setCarryOverCollapsed("wiesn-2026", false);

    await expect(isCarryOverCollapsed("wiesn-2026")).resolves.toBe(false);
  });
});
