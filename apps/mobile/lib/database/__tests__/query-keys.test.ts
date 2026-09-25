import { describe, expect, it } from "vitest";

import { ALL_LOCAL_PREFIXES, getPrefixesToRefreshAfterSync } from "../query-keys";

describe("getPrefixesToRefreshAfterSync", () => {
  it("refreshes server-computed highlights when the sync pushed something", () => {
    expect(getPrefixesToRefreshAfterSync({ success: true, pushed: 1 })).toEqual([
      ...ALL_LOCAL_PREFIXES,
      "highlights",
    ]);
  });

  it("only re-reads local caches when nothing was pushed", () => {
    expect(getPrefixesToRefreshAfterSync({ success: true, pushed: 0 })).toEqual([
      ...ALL_LOCAL_PREFIXES,
    ]);
  });

  it("still refreshes highlights when a partly failed sync pushed something", () => {
    expect(getPrefixesToRefreshAfterSync({ success: false, pushed: 1 })).toEqual(["highlights"]);
  });

  it("refreshes nothing when a failed sync pushed nothing", () => {
    expect(getPrefixesToRefreshAfterSync({ success: false, pushed: 0 })).toEqual([]);
  });
});
