import type { GlyphId } from "@prostcounter/shared/achievements";
import type { ImageSourcePropType } from "react-native";

/**
 * Static require() registry of generated glyph images. React Native's
 * bundler needs static require() calls to include an asset in the bundle
 * — a dynamic require(`...${id}...`) will not work. Add one line here
 * per PNG you drop into apps/mobile/assets/achievements/glyphs/. Ids not
 * present here fall back to a lucide icon (see achievement-badge.tsx).
 *
 * Ordered to match GLYPH_IDS.
 */
export const GLYPH_IMAGES: Partial<Record<GlyphId, ImageSourcePropType>> = {
  masskrug: require("@/assets/achievements/glyphs/masskrug.png"),
  "sunburst-stein": require("@/assets/achievements/glyphs/sunburst-stein.png"),
  "three-glasses": require("@/assets/achievements/glyphs/three-glasses.png"),
  "measuring-jug": require("@/assets/achievements/glyphs/measuring-jug.png"),
  "coin-hand": require("@/assets/achievements/glyphs/coin-hand.png"),
  purse: require("@/assets/achievements/glyphs/purse.png"),
  "calendar-check": require("@/assets/achievements/glyphs/calendar-check.png"),
  "chain-links": require("@/assets/achievements/glyphs/chain-links.png"),
  "tent-peaks": require("@/assets/achievements/glyphs/tent-peaks.png"),
  "ferris-wheel": require("@/assets/achievements/glyphs/ferris-wheel.png"),
  "compass-rose": require("@/assets/achievements/glyphs/compass-rose.png"),
  "three-figures": require("@/assets/achievements/glyphs/three-figures.png"),
  "clasped-hands": require("@/assets/achievements/glyphs/clasped-hands.png"),
  "camera-shutter": require("@/assets/achievements/glyphs/camera-shutter.png"),
  "spark-heart": require("@/assets/achievements/glyphs/spark-heart.png"),
  "laurel-cup": require("@/assets/achievements/glyphs/laurel-cup.png"),
  "podium-steps": require("@/assets/achievements/glyphs/podium-steps.png"),
  hourglass: require("@/assets/achievements/glyphs/hourglass.png"),
  "flame-steady": require("@/assets/achievements/glyphs/flame-steady.png"),
  "signal-flag": require("@/assets/achievements/glyphs/signal-flag.png"),
  "first-drop": require("@/assets/achievements/glyphs/first-drop.png"),
  "sunrise-gate": require("@/assets/achievements/glyphs/sunrise-gate.png"),
  "sunset-gate": require("@/assets/achievements/glyphs/sunset-gate.png"),
  "double-sun": require("@/assets/achievements/glyphs/double-sun.png"),
  "wiesn-crown": require("@/assets/achievements/glyphs/wiesn-crown.png"),
  "tent-ring": require("@/assets/achievements/glyphs/tent-ring.png"),
  polaroid: require("@/assets/achievements/glyphs/polaroid.png"),
  "banner-pole": require("@/assets/achievements/glyphs/banner-pole.png"),
  "id-card": require("@/assets/achievements/glyphs/id-card.png"),
  "ribbon-scroll": require("@/assets/achievements/glyphs/ribbon-scroll.png"),
};

export function getGlyphImage(glyphId: GlyphId): ImageSourcePropType | undefined {
  return GLYPH_IMAGES[glyphId];
}
