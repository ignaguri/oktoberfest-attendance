import { describe, expect, it } from "vitest";

import { formatPriceInput, parsePriceInput } from "../tent-price";

describe("parsePriceInput", () => {
  it("reads an empty field as no price rather than zero", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("   ")).toBeNull();
  });

  it("reads a plain decimal", () => {
    expect(parsePriceInput("16.20")).toBe(16.2);
  });

  it("reads a comma decimal, which is what a German keyboard offers", () => {
    expect(parsePriceInput("16,20")).toBe(16.2);
  });

  it("rejects zero and negatives, matching the database CHECK", () => {
    expect(parsePriceInput("0")).toBe("invalid");
    expect(parsePriceInput("-1")).toBe("invalid");
  });

  it("rejects text", () => {
    expect(parsePriceInput("free")).toBe("invalid");
  });
});

describe("formatPriceInput", () => {
  it("shows a blank field when there is no price", () => {
    expect(formatPriceInput(null)).toBe("");
  });

  it("round-trips a parsed price", () => {
    const parsed = parsePriceInput("16,20");
    expect(formatPriceInput(parsed as number)).toBe("16.2");
  });
});
