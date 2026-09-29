import { formatWrappedDate } from "../utils";
import type { CopyRef, StorySlide } from "./types";

/**
 * One piece of a slide's screen-reader summary, in reading order. A sentence
 * is several pieces read as one ("you had" 12 "beers"), with no stops between.
 */
export type SummaryPart = CopyRef | { text: string } | { number: number } | { sentence: SummaryPart[] };

type Language = "de" | "en" | "es";

const present = <T>(value: T | null): T[] => (value === null ? [] : [value]);

/**
 * Everything a slide shows, as one list, so screen readers get the slide as a
 * single accessible summary instead of loose, animated text nodes.
 */
export function slideSummaryParts(slide: StorySlide, language: Language): SummaryPart[] {
  switch (slide.kind) {
    case "servus":
      return [
        { text: `${formatWrappedDate(slide.startDate)} – ${formatWrappedDate(slide.endDate)}` },
        slide.title,
        slide.subtitle,
      ];
    case "bigNumber":
      // The normal tagline ("over 4 days.") finishes the sentence; the others stand alone.
      return slide.variant === "normal"
        ? [{ sentence: [slide.kicker, { number: slide.beers }, slide.unit, slide.tagline] }, ...present(slide.comparison)]
        : [{ sentence: [slide.kicker, { number: slide.beers }, slide.unit] }, slide.tagline, ...present(slide.comparison)];
    case "drinks":
      return [
        slide.title,
        ...slide.breakdown.map((drink) => ({ sentence: [drink.label, { number: drink.count }] })),
        ...present(slide.top),
        ...present(slide.spent),
      ];
    case "days":
      return [
        slide.title,
        ...(slide.bestDay
          ? [
              { text: formatWrappedDate(slide.bestDay.date) },
              { sentence: [slide.bestDay.callout, slide.bestDay.details] },
            ]
          : []),
      ];
    case "tents":
      return [
        slide.title,
        ...present(slide.favorite),
        slide.count,
        ...present(slide.share),
        ...slide.topTents.map((tent) => ({ text: tent.name })),
      ];
    case "people":
      return [slide.title, ...present(slide.groups), ...present(slide.bestPlacing), ...present(slide.photosLabel)];
    case "compare":
      return [slide.title, ...slide.rows];
    case "wiesnAndYou":
      return [slide.kicker, slide.headline, ...present(slide.share), slide.source];
    case "meanwhile":
      return [
        slide.kicker,
        ...(slide.mugs !== null && slide.mugsLine ? [{ sentence: [{ number: slide.mugs }, slide.mugsLine] }] : []),
        ...(slide.finds.length > 0 ? [slide.findsLabel] : []),
        ...slide.finds.map((find) => ({ text: find[language] ?? find.en })),
        ...present(slide.lostItems),
        slide.source,
      ];
    case "badges":
      return [slide.title, slide.count, ...slide.top.map((badge) => badge.name)];
    case "persona":
      return [slide.kicker, { text: slide.name }, slide.description, slide.because, ...present(slide.runnerUp)];
    case "prost":
      return [slide.title, slide.summary];
  }
}

/**
 * The slide's whole text as one string, for its accessibility label / live
 * region. Headings carry no full stop, so one is added where a sentence would
 * otherwise run on.
 */
export function slideSummaryText(
  slide: StorySlide,
  language: Language,
  translate: (ref: CopyRef) => string,
  formatNumber: (value: number) => string,
): string {
  const read = (part: SummaryPart): string =>
    "sentence" in part
      ? part.sentence.map(read).filter((text) => text.length > 0).join(" ")
      : "key" in part
        ? translate(part)
        : "number" in part
          ? formatNumber(part.number)
          : part.text;
  return slideSummaryParts(slide, language)
    .map(read)
    .filter((text) => text.length > 0)
    .map((text) => (/[.!?:…]$/.test(text) ? text : `${text}.`))
    .join(" ");
}
