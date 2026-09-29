import { describe, expect, it } from "vitest";

import { createLatestRequestGate } from "./latest-request";

describe("createLatestRequestGate", () => {
  it("marks a request stale once a newer one for the same key starts", () => {
    const begin = createLatestRequestGate<"a" | "b">();
    const first = begin("a");
    const other = begin("b");
    const second = begin("a");
    expect(first()).toBe(true);
    expect(second()).toBe(false);
    expect(other()).toBe(false);
  });
});
