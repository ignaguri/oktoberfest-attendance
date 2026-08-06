import type { GlyphId } from "@prostcounter/shared/achievements";
import type { ImageSourcePropType } from "react-native";

/**
 * Static require() registry of generated glyph images. React Native's
 * bundler needs static require() calls to include an asset in the bundle
 * — a dynamic require(`...${id}...`) will not work. Add one line here
 * per PNG you drop into apps/mobile/assets/achievements/glyphs/. Ids not
 * present here fall back to a lucide icon (see achievement-badge.tsx).
 *
 * Starts empty: no glyph art exists yet.
 */
export const GLYPH_IMAGES: Partial<Record<GlyphId, ImageSourcePropType>> = {
  // masskrug: require("@/assets/achievements/glyphs/masskrug.png"),
};

export function getGlyphImage(glyphId: GlyphId): ImageSourcePropType | undefined {
  return GLYPH_IMAGES[glyphId];
}
