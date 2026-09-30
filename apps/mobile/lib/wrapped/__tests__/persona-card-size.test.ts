import { describe, expect, it } from "vitest";

import { personaCardSize } from "../persona-card-size";

describe("personaCardSize", () => {
  it("fills the height on a tall area, keeping the 5:7 card ratio", () => {
    const size = personaCardSize({ width: 402, height: 420 });
    expect(size?.height).toBe(420);
    expect(size?.width).toBe(300);
  });

  it("caps the width on a wide area and derives the height from it", () => {
    const size = personaCardSize({ width: 402, height: 900 });
    expect(size?.width).toBe(346);
    expect(size?.height).toBe(484);
  });

  it("gives the crest most of the card's width", () => {
    expect(personaCardSize({ width: 402, height: 420 })?.crest).toBe(255);
  });

  it("returns nothing before the area has been measured", () => {
    expect(personaCardSize({ width: 0, height: 0 })).toBeNull();
  });
});
