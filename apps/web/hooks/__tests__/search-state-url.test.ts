import { describe, expect, it } from "vitest";

import { buildSearchStateUrl, type SearchState } from "../useSearchState";

const defaults = { limit: 50, sortBy: "created_at", sortOrder: "desc" as const };

const emptyState: SearchState = {
  search: "",
  page: 1,
  limit: 50,
  sortBy: "created_at",
  sortOrder: "desc",
  filters: {},
};

function build(state: SearchState, location: { pathname: string; search?: string; hash?: string }) {
  return buildSearchStateUrl(state, {
    location: { search: "", hash: "", ...location },
    prefix: "",
    defaults,
  });
}

describe("buildSearchStateUrl", () => {
  it("keeps the hash", () => {
    expect(build(emptyState, { pathname: "/admin", hash: "#groups" })).toBe("/admin#groups");
  });

  it("keeps query params the hook does not own", () => {
    expect(build(emptyState, { pathname: "/admin", search: "?tab=users" })).toBe(
      "/admin?tab=users",
    );
  });

  it("replaces its own params and keeps the rest", () => {
    const state = { ...emptyState, search: "anna", page: 2, filters: { role: "admin" } };
    expect(
      build(state, {
        pathname: "/admin",
        search: "?search=old&filter_status=x&tab=users",
        hash: "#users",
      }),
    ).toBe("/admin?tab=users&search=anna&page=2&filter_role=admin#users");
  });

  it("only strips params under its own prefix", () => {
    const url = buildSearchStateUrl(
      { ...emptyState, search: "x" },
      {
        location: { pathname: "/admin", search: "?search=users&g_search=old", hash: "" },
        prefix: "g_",
        defaults,
      },
    );
    expect(url).toBe("/admin?search=users&g_search=x");
  });
});
