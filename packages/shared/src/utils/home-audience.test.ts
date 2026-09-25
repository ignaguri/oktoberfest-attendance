import { describe, expect, it } from "vitest";

import { classifyHomeAudience } from "./home-audience";

describe("classifyHomeAudience", () => {
  it("is solo with no groups and no friends", () => {
    expect(classifyHomeAudience({ groupCount: 0, friendCount: 0 })).toBe("solo");
  });

  it("is social with one friend", () => {
    expect(classifyHomeAudience({ groupCount: 0, friendCount: 1 })).toBe("social");
  });

  it("is social with one group", () => {
    expect(classifyHomeAudience({ groupCount: 1, friendCount: 0 })).toBe("social");
  });
});
