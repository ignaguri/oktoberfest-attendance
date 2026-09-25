import { describe, expect, it } from "vitest";

import { ALL_LOCAL_PREFIXES, getPrefixesToRefreshAfterSync } from "../query-keys";

describe("getPrefixesToRefreshAfterSync", () => {
  it("refreshes server-computed highlights when the sync pushed something", () => {
    expect(getPrefixesToRefreshAfterSync({ pushed: 1 })).toEqual([
      ...ALL_LOCAL_PREFIXES,
      "highlights",
    ]);
  });

  it("only re-reads local caches when nothing was pushed", () => {
    expect(getPrefixesToRefreshAfterSync({ pushed: 0 })).toEqual([...ALL_LOCAL_PREFIXES]);
  });
});
