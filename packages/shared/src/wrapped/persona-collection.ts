import type { EarnedPersona } from "../schemas/wrapped.schema";
import { forFestival } from "./story/build-story";
import { PERSONA_IDS, type PersonaId, personaName } from "./story/persona";

export type PersonaCardState = "locked" | "unopened" | "opened";

export interface PersonaCardEntry {
  personaId: PersonaId;
  /** 1-based, PERSONA_IDS order */
  number: number;
  state: PersonaCardState;
  /** Wiesn variant only when earned at an Oktoberfest, as on the story's persona slide */
  name: string;
  /** i18n key for the card back's description, Generic outside the Wiesn */
  descriptionKey: string;
  /** Newest first; empty when locked */
  festivals: EarnedPersona["festivals"];
}

export interface PersonaCollection {
  cards: PersonaCardEntry[];
  collectedCount: number;
  total: number;
  /** First unopened card, else first opened card, else the first card */
  initialIndex: number;
}

/** The 10 persona cards in album order, from the earned personas the API returns. */
export function buildPersonaCollection(earned: readonly EarnedPersona[]): PersonaCollection {
  const byId = new Map(earned.map((entry) => [entry.personaId, entry]));

  const cards: PersonaCardEntry[] = PERSONA_IDS.map((personaId, index) => {
    const entry = byId.get(personaId);
    const isEarned = entry !== undefined && entry.festivals.length > 0;
    let state: PersonaCardState = "locked";
    if (isEarned) {
      state = entry.opened ? "opened" : "unopened";
    }
    const festivals = isEarned ? entry.festivals : [];
    const isWiesn = festivals.some((festival) => festival.isWiesn);
    return {
      personaId,
      number: index + 1,
      state,
      name: personaName(personaId, isWiesn),
      descriptionKey: forFestival({ key: `wrapped.story.persona.${personaId}.description` }, isWiesn).key,
      festivals,
    };
  });

  const firstUnopened = cards.findIndex((card) => card.state === "unopened");
  const firstOpened = cards.findIndex((card) => card.state === "opened");
  let initialIndex = 0;
  if (firstUnopened >= 0) {
    initialIndex = firstUnopened;
  } else if (firstOpened >= 0) {
    initialIndex = firstOpened;
  }

  return {
    cards,
    collectedCount: cards.filter((card) => card.state !== "locked").length,
    total: PERSONA_IDS.length,
    initialIndex,
  };
}
