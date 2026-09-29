import type { PersonaId } from "@prostcounter/shared/wrapped";
import type { ImageSourcePropType } from "react-native";

/**
 * Static require() registry of persona crest PNGs (assets/wrapped/crests).
 * Metro needs static requires. A persona missing here renders the SVG shield
 * in crest.tsx. Ordered to match PERSONA_IDS; file names come from
 * PERSONA_CREST_FILES.
 */
export const CREST_IMAGES: Partial<Record<PersonaId, ImageSourcePropType>> = {
  einmalAberRichtig: require("@/assets/wrapped/crests/einmal-aber-richtig.png"),
  massMeister: require("@/assets/wrapped/crests/mass-meister.png"),
  marathoner: require("@/assets/wrapped/crests/marathoner.png"),
  zeltwanderer: require("@/assets/wrapped/crests/zeltwanderer.png"),
  stammgast: require("@/assets/wrapped/crests/stammgast.png"),
  fruehschoppen: require("@/assets/wrapped/crests/fruehschoppen.png"),
  nachteule: require("@/assets/wrapped/crests/nachteule.png"),
  radlerDiplomat: require("@/assets/wrapped/crests/radler-diplomat.png"),
  wochenendKrieger: require("@/assets/wrapped/crests/wochenend-krieger.png"),
  geniesser: require("@/assets/wrapped/crests/geniesser.png"),
};

export function getCrestImage(personaId: PersonaId): ImageSourcePropType | undefined {
  return Object.hasOwn(CREST_IMAGES, personaId) ? CREST_IMAGES[personaId] : undefined;
}
