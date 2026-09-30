import type { EarnedPersona } from "../schemas/wrapped.schema";
import { PERSONA_IDS, type PersonaId } from "./story/persona";

export type PersonaCardState = "locked" | "unopened" | "opened";

export interface PersonaCardEntry {
  personaId: PersonaId;
  /** 1-based, PERSONA_IDS order */
  number: number;
  state: PersonaCardState;
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
    return { personaId, number: index + 1, state, festivals: isEarned ? entry.festivals : [] };
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
