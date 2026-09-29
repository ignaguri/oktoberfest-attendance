import type {
  WrappedData,
  WrappedOfficialStats,
} from "../../schemas/wrapped.schema";
import { buildWrappedStory } from "../story/build-story";
import type {
  CopyRef,
  StatCard,
  StorySlide,
  StorySlideKind,
  StorySlideOf,
} from "../story/types";
import {
  type CityShareCard,
  LINKABLE_SHARE_CARD_KINDS,
  type LinkableShareCardKind,
  type NumbersShareCard,
  type PersonaShareCard,
  type PhotosShareCard,
  type RhythmShareCard,
  type ShareCard,
} from "./types";

const copy = (key: string, params?: CopyRef["params"]): CopyRef =>
  params
    ? { key: `wrapped.shareCards.${key}`, params }
    : { key: `wrapped.shareCards.${key}` };

function findSlide<K extends StorySlideKind>(
  slides: StorySlide[],
  kind: K,
): StorySlideOf<K> | null {
  return (
    (slides.find((slide) => slide.kind === kind) as
      StorySlideOf<K> | undefined) ?? null
  );
}

function numbersCard(
  data: WrappedData,
  slides: StorySlide[],
  kicker: CopyRef,
): NumbersShareCard | null {
  const bigNumber = findSlide(slides, "bigNumber");
  if (!bigNumber) {
    return null;
  }
  const { totalBeers, daysAttended } = data.basicStats;
  const tents = data.tentStats.uniqueTents;
  const hasBeers = totalBeers > 0;
  const boxes: StatCard[] = [];
  if (hasBeers) {
    boxes.push({
      stat: copy("numbers.boxStat", { value: daysAttended }),
      caption: copy("numbers.days", { count: daysAttended }),
    });
  }
  if (tents > 0) {
    boxes.push({
      stat: copy("numbers.boxStat", { value: tents }),
      caption: copy("numbers.tents", { count: tents }),
    });
  }
  const favoriteTent = data.tentStats.favoriteTent;
  return {
    kind: "numbers",
    kicker,
    value: hasBeers ? totalBeers : daysAttended,
    unit: hasBeers
      ? bigNumber.unit
      : copy("numbers.days", { count: daysAttended }),
    comparison: bigNumber.comparison,
    boxes,
    homeTent: favoriteTent
      ? copy("numbers.homeTent", { tent: favoriteTent })
      : null,
  };
}

function personaCard(
  slides: StorySlide[],
  kicker: CopyRef,
): PersonaShareCard | null {
  const persona = findSlide(slides, "persona");
  const prost = findSlide(slides, "prost");
  if (!persona || !prost) {
    return null;
  }
  return {
    kind: "persona",
    kicker,
    personaId: persona.personaId,
    name: persona.name,
    description: persona.description,
    facts: prost.recap.facts,
  };
}

function rhythmCard(
  data: WrappedData,
  slides: StorySlide[],
  kicker: CopyRef,
): RhythmShareCard | null {
  const days = findSlide(slides, "days");
  if (!days) {
    return null;
  }
  const isWiesn = data.festivalInfo.festivalType === "oktoberfest";
  const best = data.peakMoments.bestDay;
  return {
    kind: "rhythm",
    kicker,
    title: copy(isWiesn ? "rhythm.title" : "rhythm.titleGeneric", {
      count: data.basicStats.daysAttended,
    }),
    bars: days.bars,
    bestDay:
      days.bestDay && best
        ? {
            date: best.date,
            beers: {
              key: "wrapped.story.units.beers",
              params: { count: best.beerCount },
            },
          }
        : null,
  };
}

function cityCard(
  data: WrappedData,
  stats: WrappedOfficialStats | null,
  slides: StorySlide[],
  kicker: CopyRef,
): CityShareCard | null {
  const city = findSlide(slides, "wiesnAndYou");
  if (!city || !stats || (!city.visitors && !city.share)) {
    return null;
  }
  const when = stats.isCurrentFestival ? "current" : "lastYear";
  return {
    kind: "city",
    kicker,
    title: city.kicker,
    visitors: city.visitors
      ? { stat: city.visitors.stat, caption: copy(`city.visitors.${when}`) }
      : null,
    share: city.share
      ? {
          stat: city.share.stat,
          caption: copy(`city.share.${when}`, {
            count: data.basicStats.totalBeers,
          }),
        }
      : null,
    mugs: city.mugs,
    source: city.source,
  };
}

function photosCard(
  slides: StorySlide[],
  kicker: CopyRef,
): PhotosShareCard | null {
  const people = findSlide(slides, "people");
  if (!people || people.photos.length === 0) {
    return null;
  }
  return {
    kind: "photos",
    kicker,
    title: copy("photos.title"),
    photos: people.photos,
    groups: people.groups,
    bestPlacing: people.bestPlacing,
  };
}

/** The cards a Wrapped can be shared as, in carousel order. Pure. */
export function buildShareCards(
  data: WrappedData,
  officialStats: WrappedOfficialStats | null,
  now: Date = new Date(),
): ShareCard[] {
  const slides = buildWrappedStory(data, officialStats, now);
  const kicker = copy("kicker", { festival: data.festivalInfo.name });
  const cards: (ShareCard | null)[] = [
    numbersCard(data, slides, kicker),
    personaCard(slides, kicker),
    rhythmCard(data, slides, kicker),
    cityCard(data, officialStats, slides, kicker),
    photosCard(slides, kicker),
  ];
  return cards.filter((card): card is ShareCard => card !== null);
}

export function isLinkableShareCardKind(
  kind: string,
): kind is LinkableShareCardKind {
  return (LINKABLE_SHARE_CARD_KINDS as readonly string[]).includes(kind);
}

/** Bump whenever a layout changes, so every cached card image refreshes. */
export const SHARE_CARD_RENDER_VERSION = "2";

/** A cheap hash (djb2) of the content and layout version, for naming cached card files; not for security. */
export function shareCardFingerprint(
  card: ShareCard,
  renderVersion: string = SHARE_CARD_RENDER_VERSION,
): string {
  const text = JSON.stringify(card) + renderVersion;
  let hash = 5381;
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
}
