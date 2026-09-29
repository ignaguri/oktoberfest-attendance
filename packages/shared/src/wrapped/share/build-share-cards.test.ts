import { describe, expect, it } from "vitest";

import { makeOfficialStats, makeWrapped } from "../story/story-fixtures";
import {
  buildShareCards,
  isLinkableShareCardKind,
  shareCardFingerprint,
} from "./build-share-cards";
import { LINKABLE_SHARE_CARD_KINDS } from "./types";

const kinds = (cards: { kind: string }[]) => cards.map((card) => card.kind);

describe("buildShareCards", () => {
  it("offers every card for a full Wrapped, numbers first", () => {
    const cards = buildShareCards(makeWrapped(), makeOfficialStats());
    expect(kinds(cards)).toEqual([
      "numbers",
      "persona",
      "rhythm",
      "city",
      "photos",
    ]);
    expect(cards[0].kicker).toEqual({
      key: "wrapped.shareCards.kicker",
      params: { festival: "Oktoberfest 2026" },
    });
  });

  it("drops city without official stats and photos without pictures", () => {
    const data = makeWrapped((wrapped) => {
      wrapped.socialStats.pictures = [];
      wrapped.socialStats.groupsJoined = 0;
    });
    expect(kinds(buildShareCards(data, null))).toEqual([
      "numbers",
      "persona",
      "rhythm",
    ]);
  });

  it("leads with days and drops rhythm for a zero-beer attendee", () => {
    const data = makeWrapped((wrapped) => {
      wrapped.basicStats.totalBeers = 0;
      wrapped.timeline = wrapped.timeline.map((day) => ({
        ...day,
        beerCount: 0,
      }));
      wrapped.peakMoments.bestDay = null;
    });
    const cards = buildShareCards(data, makeOfficialStats());
    expect(kinds(cards)).not.toContain("rhythm");
    const numbers = cards.find((card) => card.kind === "numbers");
    expect(numbers).toMatchObject({
      value: 4,
      unit: { key: "wrapped.shareCards.numbers.days", params: { count: 4 } },
    });
    expect(
      numbers?.kind === "numbers" &&
        numbers.boxes.map((box) => box.caption.key),
    ).toEqual(["wrapped.shareCards.numbers.tents"]);
    const city = cards.find((card) => card.kind === "city");
    expect(city?.kind === "city" && city.share).toBeNull();
    expect(city?.kind === "city" && city.visitors?.caption.key).toBe(
      "wrapped.shareCards.city.visitors.current",
    );
  });

  it("uses the neutral rhythm title outside Oktoberfest", () => {
    const data = makeWrapped((wrapped) => {
      wrapped.festivalInfo = {
        ...wrapped.festivalInfo,
        name: "Starkbierfest 2026",
        festivalType: "starkbierfest",
      };
    });
    const rhythm = buildShareCards(data, null).find(
      (card) => card.kind === "rhythm",
    );
    expect(rhythm?.kind === "rhythm" && rhythm.title.key).toBe(
      "wrapped.shareCards.rhythm.titleGeneric",
    );
  });

  it("drops city when the stats have neither visitors nor Maß", () => {
    const stats = makeOfficialStats({ visitors: null, massServed: null });
    expect(kinds(buildShareCards(makeWrapped(), stats))).not.toContain("city");
  });

  it("never lets photos be published by link", () => {
    expect(LINKABLE_SHARE_CARD_KINDS).not.toContain("photos");
    expect(isLinkableShareCardKind("photos")).toBe(false);
    expect(isLinkableShareCardKind("numbers")).toBe(true);
  });

  it("fingerprints a card by its content", () => {
    const [a] = buildShareCards(makeWrapped(), null);
    const [b] = buildShareCards(
      makeWrapped((wrapped) => {
        wrapped.basicStats.totalBeers = 13;
      }),
      null,
    );
    expect(shareCardFingerprint(a)).toBe(
      shareCardFingerprint(structuredClone(a)),
    );
    expect(shareCardFingerprint(a)).not.toBe(shareCardFingerprint(b));
  });

  it("changes the fingerprint when the layouts change", () => {
    const [card] = buildShareCards(makeWrapped(), null);
    expect(shareCardFingerprint(card, "1")).not.toBe(
      shareCardFingerprint(card, "2"),
    );
  });
});
