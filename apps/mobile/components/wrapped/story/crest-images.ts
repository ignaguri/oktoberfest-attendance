import type { PersonaId } from "@prostcounter/shared/wrapped";
import type { ImageSourcePropType } from "react-native";

/**
 * Static require() registry of persona crest PNGs (assets/wrapped/crests).
 * Metro needs static requires. A persona missing here renders the SVG shield
 * in crest.tsx. Ordered to match PERSONA_IDS; file names come from
 * PERSONA_CREST_FILES.
 */
export const CREST_IMAGES: Partial<Record<PersonaId, ImageSourcePropType>> = {};

export function getCrestImage(personaId: PersonaId): ImageSourcePropType | undefined {
  return Object.hasOwn(CREST_IMAGES, personaId) ? CREST_IMAGES[personaId] : undefined;
}
