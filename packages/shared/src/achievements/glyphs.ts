// The 30 distinct glyph ids used across all achievement definitions
// (20 series + 10 one-offs). Verify against ALL_DEFINITIONS if
// definitions.ts changes - the exhaustiveness test in glyphs.test.ts
// will fail if this list drifts.
export const GLYPH_IDS = [
  "masskrug",
  "sunburst-stein",
  "three-glasses",
  "measuring-jug",
  "coin-hand",
  "purse",
  "calendar-check",
  "chain-links",
  "tent-peaks",
  "ferris-wheel",
  "compass-rose",
  "three-figures",
  "clasped-hands",
  "camera-shutter",
  "spark-heart",
  "laurel-cup",
  "podium-steps",
  "hourglass",
  "flame-steady",
  "signal-flag",
  "first-drop",
  "sunrise-gate",
  "sunset-gate",
  "double-sun",
  "wiesn-crown",
  "tent-ring",
  "polaroid",
  "banner-pole",
  "id-card",
  "ribbon-scroll",
] as const;

export type GlyphId = (typeof GLYPH_IDS)[number];

// Nearest-match lucide icon name per glyph, used whenever no generated
// image exists yet for that id (see apps/*/components/achievements for
// the per-platform image registries). Plain strings only - this module
// must not import lucide, to stay framework-agnostic like the rest of
// packages/shared. Every name here must exist in both lucide-react and
// lucide-react-native (verified during planning against the installed
// lucide-react package - both packages are pinned to the same version).
export const GLYPH_FALLBACK_ICONS: Record<GlyphId, string> = {
  masskrug: "Beer",
  "sunburst-stein": "Beer",
  "three-glasses": "GlassWater",
  "measuring-jug": "Beaker",
  "coin-hand": "Coins",
  purse: "Wallet",
  "calendar-check": "CalendarCheck",
  "chain-links": "Link",
  "tent-peaks": "Tent",
  "ferris-wheel": "FerrisWheel",
  "compass-rose": "Compass",
  "three-figures": "Users",
  "clasped-hands": "Handshake",
  "camera-shutter": "Camera",
  "spark-heart": "Heart",
  "laurel-cup": "Trophy",
  "podium-steps": "Award",
  hourglass: "Hourglass",
  "flame-steady": "Flame",
  "signal-flag": "Flag",
  "first-drop": "Droplet",
  "sunrise-gate": "Sunrise",
  "sunset-gate": "Sunset",
  "double-sun": "Sun",
  "wiesn-crown": "Crown",
  "tent-ring": "Tent",
  polaroid: "Image",
  "banner-pole": "Flag",
  "id-card": "IdCard",
  "ribbon-scroll": "ScrollText",
};
