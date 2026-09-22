import { describe, expect, it } from "vitest";

import { toWebRoute } from "../notification-route";

const GROUP_ID = "d9a89e1a-0000-4000-8000-000000000000";

describe("toWebRoute", () => {
  it("sends group settings to the web settings page", () => {
    expect(toWebRoute(`/group-detail/${GROUP_ID}/settings`)).toBe(`/group-settings/${GROUP_ID}`);
  });

  it("sends group detail to the web group page", () => {
    expect(toWebRoute(`/group-detail/${GROUP_ID}`)).toBe(`/groups/${GROUP_ID}`);
  });

  it("sends group messages to the web messages page", () => {
    expect(toWebRoute(`/group-detail/${GROUP_ID}/messages`)).toBe(`/groups/${GROUP_ID}/messages`);
  });

  it("keeps a query string on a group sub-page", () => {
    expect(toWebRoute(`/group-detail/${GROUP_ID}/messages?highlight=1`)).toBe(
      `/groups/${GROUP_ID}/messages?highlight=1`,
    );
  });

  it("keeps a query string", () => {
    expect(toWebRoute(`/group-detail/${GROUP_ID}?tab=members`)).toBe(
      `/groups/${GROUP_ID}?tab=members`,
    );
  });

  it.each(["/achievements", "/friends?tab=requests", "/join-group?token=abc", "/groups"])(
    "leaves %s alone",
    (route) => {
      expect(toWebRoute(route)).toBe(route);
    },
  );
});
