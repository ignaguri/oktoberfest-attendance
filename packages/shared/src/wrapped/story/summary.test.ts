import i18next from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import en from "../../i18n/locales/en.json";
import { buildWrappedStory } from "./build-story";
import { makeOfficialStats, makeWrapped } from "./story-fixtures";
import { type SummaryPart, slideSummaryParts, slideSummaryText } from "./summary";
import type { CopyRef, StorySlide, StorySlideKind } from "./types";

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

const flat = (parts: SummaryPart[]): SummaryPart[] =>
  parts.flatMap((part) => ("sentence" in part ? flat(part.sentence) : [part]));

describe("slideSummaryParts", () => {
  it.each(slides.map((slide) => [slide.kind, slide] as const))(
    "reads out every piece of copy on the %s slide",
    (_kind, slide) => {
      const parts = flat(slideSummaryParts(slide, "en"));
      for (const ref of copyRefs(slide)) {
        expect(parts).toContainEqual(ref);
      }
    },
  );

  it("includes the text that is not copy: persona name, finds, the big number", () => {
    const persona = slides.find((slide) => slide.kind === "persona");
    const wiesn = slides.find((slide) => slide.kind === "wiesnAndYou");
    const bigNumber = slides.find((slide) => slide.kind === "bigNumber");
    if (!persona || !wiesn || !bigNumber) {
      throw new Error("fixture story is missing a slide");
    }

    expect(flat(slideSummaryParts(persona, "en"))).toContainEqual({ text: persona.name });
    expect(flat(slideSummaryParts(wiesn, "de"))).toContainEqual({ text: wiesn.finds[0].de });
    expect(flat(slideSummaryParts(bigNumber, "en"))).toContainEqual({ number: bigNumber.beers });
  });
});

describe("slideSummaryText", () => {
  const i18n = i18next.createInstance();
  beforeAll(async () => {
    await i18n.init({ resources: { en: { translation: en } }, lng: "en", interpolation: { escapeValue: false } });
  });
  const text = (kind: StorySlideKind) => {
    const slide = slides.find((candidate) => candidate.kind === kind) as StorySlide;
    const translate = i18n.t as unknown as (key: string, options?: Record<string, unknown>) => string;
    return slideSummaryText(slide, "en", (ref) => translate(ref.key, ref.params), (value) => String(value));
  };

  it("reads the big number as one sentence", () => {
    expect(text("bigNumber")).toMatch(/^At Oktoberfest 2026 you had 12\.5 beers over 4 days\. /);
  });

  it("gives every drink its count, as the bars do", () => {
    expect(text("drinks")).toContain("Beer 11. Radler 3.");
  });

  it("names the best day and keeps its details in the same sentence", () => {
    expect(text("days")).toContain("20 September 2026. Best day: 5 beers across 2 tents.");
  });

  it("lists the top tents", () => {
    expect(text("tents")).toContain("Augustiner-Festhalle. Schottenhamel.");
  });

  it("reads the mug count with its line", () => {
    expect(text("wiesnAndYou")).toContain("116,000 Maß mugs tried to sneak out.");
  });
});
