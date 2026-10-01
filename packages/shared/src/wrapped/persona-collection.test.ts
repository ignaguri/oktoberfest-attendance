import { describe, expect, it } from "vitest";

import type { EarnedPersona } from "../schemas/wrapped.schema";
import { buildPersonaCollection } from "./persona-collection";
import { PERSONA_IDS } from "./story/persona";

const okt26 = { festivalId: "11111111-1111-4111-8111-111111111111", name: "Oktoberfest 2026", isWiesn: true };
const fruehling26 = { festivalId: "22222222-2222-4222-8222-222222222222", name: "Frühlingsfest 2026", isWiesn: false };

describe("buildPersonaCollection", () => {
  it("returns all 10 locked cards for a user with nothing earned", () => {
    const collection = buildPersonaCollection([]);
    expect(collection.cards).toHaveLength(10);
    expect(collection.cards.map((card) => card.personaId)).toEqual([...PERSONA_IDS]);
    expect(collection.cards.map((card) => card.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(collection.cards.every((card) => card.state === "locked")).toBe(true);
    expect(collection.collectedCount).toBe(0);
    expect(collection.total).toBe(10);
    expect(collection.initialIndex).toBe(0);
  });

  it("marks earned cards opened or unopened and keeps festival order", () => {
    const earned: EarnedPersona[] = [
      { personaId: "stammgast", festivals: [fruehling26], opened: true },
      { personaId: "nachteule", festivals: [okt26, fruehling26], opened: false },
    ];
    const collection = buildPersonaCollection(earned);
    const byId = Object.fromEntries(collection.cards.map((card) => [card.personaId, card]));
    expect(byId.stammgast.state).toBe("opened");
    expect(byId.nachteule.state).toBe("unopened");
    expect(byId.nachteule.festivals).toEqual([okt26, fruehling26]);
    expect(byId.massMeister.state).toBe("locked");
    expect(byId.massMeister.festivals).toEqual([]);
    expect(collection.collectedCount).toBe(2);
  });

  it("starts on the first unopened card", () => {
    const collection = buildPersonaCollection([
      { personaId: "massMeister", festivals: [okt26], opened: true },
      { personaId: "nachteule", festivals: [okt26], opened: false },
    ]);
    expect(collection.initialIndex).toBe(PERSONA_IDS.indexOf("nachteule"));
  });

  it("starts on the first opened card when none are unopened", () => {
    const collection = buildPersonaCollection([
      { personaId: "radlerDiplomat", festivals: [okt26], opened: true },
      { personaId: "zeltwanderer", festivals: [okt26], opened: true },
    ]);
    expect(collection.initialIndex).toBe(PERSONA_IDS.indexOf("zeltwanderer"));
  });

  it("treats an earned entry with no festivals as locked", () => {
    const collection = buildPersonaCollection([{ personaId: "geniesser", festivals: [], opened: false }]);
    expect(collection.cards[9].state).toBe("locked");
    expect(collection.collectedCount).toBe(0);
  });

  it("names a marathoner earned only outside the Wiesn Fest-Marathoner, with the generic description", () => {
    const card = buildPersonaCollection([{ personaId: "marathoner", festivals: [fruehling26], opened: true }]).cards[
      PERSONA_IDS.indexOf("marathoner")
    ];
    expect(card.name).toBe("Fest-Marathoner");
    expect(card.descriptionKey).toBe("wrapped.story.persona.marathoner.descriptionGeneric");
  });

  it("keeps Wiesn-Marathoner when any of its festivals was an Oktoberfest", () => {
    const card = buildPersonaCollection([{ personaId: "marathoner", festivals: [fruehling26, okt26], opened: true }])
      .cards[PERSONA_IDS.indexOf("marathoner")];
    expect(card.name).toBe("Wiesn-Marathoner");
    expect(card.descriptionKey).toBe("wrapped.story.persona.marathoner.description");
  });

  it("names other personas the same at any festival", () => {
    const card = buildPersonaCollection([{ personaId: "nachteule", festivals: [fruehling26], opened: true }]).cards[
      PERSONA_IDS.indexOf("nachteule")
    ];
    expect(card.name).toBe("Nachteule");
    expect(card.descriptionKey).toBe("wrapped.story.persona.nachteule.description");
  });
});
