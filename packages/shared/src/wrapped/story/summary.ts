import { formatWrappedDate } from "../utils";
import type { CopyRef, StorySlide } from "./types";

/** One piece of a slide's screen-reader summary, in reading order. */
export type SummaryPart = CopyRef | { text: string } | { number: number };

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
      return [slide.kicker, { number: slide.beers }, slide.unit, slide.tagline, ...present(slide.comparison)];
    case "drinks":
      return [
        slide.title,
        ...slide.breakdown.map((drink) => drink.label),
        ...present(slide.top),
        ...present(slide.spent),
      ];
    case "days":
      return [slide.title, ...(slide.bestDay ? [slide.bestDay.callout, slide.bestDay.details] : [])];
    case "tents":
      return [slide.title, ...present(slide.favorite), slide.count, ...present(slide.share)];
    case "people":
      return [slide.title, ...present(slide.groups), ...present(slide.bestPlacing), ...present(slide.photosLabel)];
    case "compare":
      return [slide.title, ...slide.rows];
    case "wiesnAndYou":
      return [slide.kicker, slide.headline, ...present(slide.share), slide.source];
    case "meanwhile":
      return [
        slide.kicker,
        ...(slide.mugs !== null && slide.mugsLine ? [{ number: slide.mugs }, slide.mugsLine] : []),
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
