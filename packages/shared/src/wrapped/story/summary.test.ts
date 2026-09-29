import { describe, expect, it } from "vitest";

import { buildWrappedStory } from "./build-story";
import { makeOfficialStats, makeWrapped } from "./story-fixtures";
import { slideSummaryParts } from "./summary";
import type { CopyRef } from "./types";

function copyRefs(node: unknown): CopyRef[] {
  if (Array.isArray(node)) {
    return node.flatMap(copyRefs);
  }
  if (node && typeof node === "object") {
    if ("key" in node && typeof (node as { key: unknown }).key === "string") {
      return [node as CopyRef];
    }
    return Object.values(node).flatMap(copyRefs);
  }
  return [];
}

const slides = buildWrappedStory(makeWrapped(), makeOfficialStats());

describe("slideSummaryParts", () => {
  it.each(slides.map((slide) => [slide.kind, slide] as const))(
    "reads out every piece of copy on the %s slide",
    (_kind, slide) => {
      const parts = slideSummaryParts(slide, "en");
      for (const ref of copyRefs(slide)) {
        expect(parts).toContainEqual(ref);
      }
    },
  );

  it("includes the text that is not copy: persona name, finds, the big number", () => {
    const persona = slides.find((slide) => slide.kind === "persona");
    const meanwhile = slides.find((slide) => slide.kind === "meanwhile");
    const bigNumber = slides.find((slide) => slide.kind === "bigNumber");
    if (!persona || !meanwhile || !bigNumber) {
      throw new Error("fixture story is missing a slide");
    }

    expect(slideSummaryParts(persona, "en")).toContainEqual({ text: persona.name });
    expect(slideSummaryParts(meanwhile, "de")).toContainEqual({ text: meanwhile.finds[0].de });
    expect(slideSummaryParts(bigNumber, "en")).toContainEqual({ number: bigNumber.beers });
  });
});
