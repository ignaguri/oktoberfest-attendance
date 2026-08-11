import { describe, expect, it } from "vitest";

import { ALL_SLUGS } from "./definitions";
import { describeUnlock, nameKeyFor } from "./unlock-display";

describe("nameKeyFor", () => {
  it("builds the i18n key for a series tier slug", () => {
    expect(nameKeyFor("drinks_total.t2")).toBe("achievements.drinks_total.t2.name");
  });

  it("builds the i18n key for a one-off slug", () => {
    expect(nameKeyFor("first_drink")).toBe("achievements.first_drink.name");
  });
});

describe("describeUnlock", () => {
  it("describes a series tier from its definition", () => {
    const descriptor = describeUnlock("drinks_total.t2");

    expect(descriptor).toEqual({
      slug: "drinks_total.t2",
      seriesId: "drinks_total",
      tier: 2,
      category: "drinking",
      scope: "festival",
      glyph: "masskrug",
      points: 50,
    });
  });

  it("describes a one-off with a null seriesId", () => {
    const descriptor = describeUnlock("first_drink");

    expect(descriptor?.seriesId).toBeNull();
    expect(descriptor?.scope).toBe("lifetime");
    expect(descriptor?.glyph).toBe("first-drop");
  });

  it("returns null for a slug no definition owns", () => {
    expect(describeUnlock("not_a_real_slug")).toBeNull();
  });

  it("describes every slug the registry knows about", () => {
    for (const slug of ALL_SLUGS) {
      expect(describeUnlock(slug), slug).not.toBeNull();
    }
  });
});
