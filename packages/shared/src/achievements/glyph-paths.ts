import type { GlyphId } from "./glyphs";

/**
 * Vector artwork for every achievement glyph, drawn on a 24x24 grid.
 *
 * Each glyph is a list of filled paths in two tones: `solid` takes the
 * category colour and carries the shape you actually recognise, `tint`
 * takes the lighter companion colour (see `getCategoryTintColor`) and
 * carries supporting mass. There are no strokes and no transparency, so a
 * glyph reads the same on any background.
 *
 * Two rules keep the set coherent, both learned the hard way from the PNG
 * set this replaces:
 *  - Nothing touches the outer 2px of the grid, so glyphs sit evenly inside
 *    the badge ring at every size.
 *  - No glyph contains a full enclosing ring. The badge already draws one,
 *    and a second concentric ring reads as a target rather than a badge.
 */
export type GlyphTone = "solid" | "tint";

export type GlyphShape = {
  readonly d: string;
  readonly tone: GlyphTone;
  /** Set only where a path relies on an even-odd hole (rings, cut-outs). */
  readonly fillRule?: "evenodd";
  /** Set only where a shape is a rotated copy of another (rays, spokes). */
  readonly transform?: string;
};

/** The grid every path is drawn on; renderers scale from this. */
export const GLYPH_VIEWBOX = 24;

export const GLYPH_PATHS: Record<GlyphId, readonly GlyphShape[]> = {
  masskrug: [
    { d: "M6 8 H15 V17.5 A2.5 2.5 0 0 1 12.5 20 H8.5 A2.5 2.5 0 0 1 6 17.5 Z", tone: "tint" },
    { d: "M15.2 10 H17.2 A3.2 3.2 0 0 1 17.2 16.4 H15.2 V14.4 H16.6 A1.2 1.2 0 0 0 16.6 12 H15.2 Z", tone: "solid" },
    { d: "M5.6 8 V6.6 A2.1 2.1 0 0 1 8.2 4.3 A2.9 2.9 0 0 1 13.2 4.6 A2.1 2.1 0 0 1 15.4 6.8 V8 Z", tone: "solid" },
  ],
  "sunburst-stein": [
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(45 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(90 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(135 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(180 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(225 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(270 12 12)" },
    { d: "M11.1 1 H12.9 L12 4.6 Z", tone: "solid", transform: "rotate(315 12 12)" },
    { d: "M8.4 10.4 H14.4 V17 A1.8 1.8 0 0 1 12.6 18.8 H10.2 A1.8 1.8 0 0 1 8.4 17 Z", tone: "tint" },
    { d: "M8 10.4 V9.4 A1.6 1.6 0 0 1 10 8 A2.2 2.2 0 0 1 13.6 7.8 A1.6 1.6 0 0 1 14.8 9.4 V10.4 Z", tone: "solid" },
    { d: "M14.6 11.8 H16 A2.4 2.4 0 0 1 16 16.6 H14.6 V15.2 H15.6 A1 1 0 0 0 15.6 13.2 H14.6 Z", tone: "solid" },
  ],
  "three-glasses": [
    { d: "M3.2 8 H8.2 V17.2 A1.6 1.6 0 0 1 6.6 18.8 H4.8 A1.6 1.6 0 0 1 3.2 17.2 Z", tone: "tint" },
    { d: "M2.8 6.4 H8.6 V8 H2.8 Z", tone: "solid" },
    { d: "M9.6 6.4 H14.4 V9.2 A2.4 2.4 0 0 1 9.6 9.2 Z", tone: "solid" },
    { d: "M11.6 11.6 H12.4 V17.2 H11.6 Z", tone: "solid" },
    { d: "M10 17.2 H14 V18.8 H10 Z", tone: "solid" },
    { d: "M15.8 8 H20.4 L19.8 18.8 H16.4 Z", tone: "tint" },
    { d: "M15.6 6.4 H20.6 V8 H15.6 Z", tone: "solid" },
  ],
  "measuring-jug": [
    { d: "M5 7.6 H15 L14.2 18.4 A1.6 1.6 0 0 1 12.6 19.8 H7.4 A1.6 1.6 0 0 1 5.8 18.4 Z", tone: "tint" },
    { d: "M4.4 6 H15.6 V7.6 H4.4 Z", tone: "solid" },
    { d: "M15.6 6.6 L18.2 8.2 L15.6 9.8 Z", tone: "solid" },
    { d: "M15.2 10.8 H16.4 A2.6 2.6 0 0 1 16.4 16 H14.8 V14.6 H16 A1.2 1.2 0 0 0 16 12.2 H15.1 Z", tone: "solid" },
    { d: "M6.1 12.6 H13.95 V14.1 H6 Z", tone: "solid" },
  ],
  "coin-hand": [
    { d: "M4.4 13.2 A7.6 7.6 0 0 0 19.6 13.2 Z", tone: "tint" },
    { d: "M3 11.6 A1.7 1.7 0 0 1 6.4 11.6 V13.4 H3 Z", tone: "tint" },
    { d: "M8.7 6.4 A3.3 3.3 0 1 0 15.3 6.4 A3.3 3.3 0 1 0 8.7 6.4 Z", tone: "solid" },
    { d: "M10.4 6.4 A1.6 1.6 0 1 0 13.6 6.4 A1.6 1.6 0 1 0 10.4 6.4 Z", tone: "tint" },
  ],
  purse: [
    { d: "M4 8.6 H20 A1.8 1.8 0 0 1 21.8 10.4 V18.6 A1.8 1.8 0 0 1 20 20.4 H4 A1.8 1.8 0 0 1 2.2 18.6 V10.4 A1.8 1.8 0 0 1 4 8.6 Z", tone: "tint" },
    { d: "M2.2 10.4 A1.8 1.8 0 0 1 4 8.6 H17.4 A1.4 1.4 0 0 1 17.4 5.8 H5.4 A3.2 3.2 0 0 0 2.2 9 Z", tone: "solid" },
    { d: "M16.4 14.5 A1.8 1.8 0 1 0 20 14.5 A1.8 1.8 0 1 0 16.4 14.5 Z", tone: "solid" },
  ],
  "calendar-check": [
    { d: "M4 6.4 H20 A1.6 1.6 0 0 1 21.6 8 V19 A1.6 1.6 0 0 1 20 20.6 H4 A1.6 1.6 0 0 1 2.4 19 V8 A1.6 1.6 0 0 1 4 6.4 Z", tone: "tint" },
    { d: "M2.4 8 A1.6 1.6 0 0 1 4 6.4 H20 A1.6 1.6 0 0 1 21.6 8 V10.4 H2.4 Z", tone: "solid" },
    { d: "M6.8 3.2 H8.6 V7.4 H6.8 Z", tone: "solid" },
    { d: "M15.4 3.2 H17.2 V7.4 H15.4 Z", tone: "solid" },
    { d: "M7.6 15 L10.2 17.6 L16.2 11.6 L17.8 13.2 L10.2 20.8 L6 16.6 Z", tone: "solid" },
  ],
  "chain-links": [
    { d: "M4.6 8.4 H13 A3.6 3.6 0 0 1 13 15.6 H4.6 A3.6 3.6 0 0 1 4.6 8.4 Z M4.6 10.6 H13 A1.4 1.4 0 0 1 13 13.4 H4.6 A1.4 1.4 0 0 1 4.6 10.6 Z", tone: "tint", fillRule: "evenodd" },
    { d: "M11 8.4 H19.4 A3.6 3.6 0 0 1 19.4 15.6 H11 A3.6 3.6 0 0 1 11 8.4 Z M11 10.6 H19.4 A1.4 1.4 0 0 1 19.4 13.4 H11 A1.4 1.4 0 0 1 11 10.6 Z", tone: "solid", fillRule: "evenodd" },
  ],
  "tent-peaks": [
    { d: "M7.4 7.6 L13.4 14.6 V19.4 H1.4 V14.6 Z", tone: "tint" },
    { d: "M15 6.4 L22 15 V19.4 H8 V15 Z", tone: "solid" },
    { d: "M12.9 19.4 V16.4 A2.1 2.1 0 0 1 17.1 16.4 V19.4 Z", tone: "tint" },
  ],
  "ferris-wheel": [
    { d: "M12 2.5 A8.2 8.2 0 1 0 12 18.9 A8.2 8.2 0 1 0 12 2.5 Z", tone: "tint" },
    { d: "M12 2 A8.7 8.7 0 1 0 12 19.4 A8.7 8.7 0 1 0 12 2 Z M12 4 A6.7 6.7 0 1 1 12 17.4 A6.7 6.7 0 1 1 12 4 Z", tone: "solid", fillRule: "evenodd" },
    { d: "M4.2 10.1 H19.8 V11.3 H4.2 Z", tone: "solid" },
    { d: "M4.2 10.1 H19.8 V11.3 H4.2 Z", tone: "solid", transform: "rotate(60 12 10.7)" },
    { d: "M4.2 10.1 H19.8 V11.3 H4.2 Z", tone: "solid", transform: "rotate(120 12 10.7)" },
    { d: "M10.1 10.7 A1.9 1.9 0 1 0 13.9 10.7 A1.9 1.9 0 1 0 10.1 10.7 Z", tone: "solid" },
    { d: "M10.7 16.6 L7.3 22.2 H9.7 L12 18.4 L14.3 22.2 H16.7 L13.3 16.6 Z", tone: "solid" },
  ],
  "compass-rose": [
    { d: "M12 5.4 L13.3 12 L12 18.6 L10.7 12 Z", tone: "tint", transform: "rotate(45 12 12)" },
    { d: "M12 5.4 L13.3 12 L12 18.6 L10.7 12 Z", tone: "tint", transform: "rotate(135 12 12)" },
    { d: "M2.4 12 L12 9.8 L21.6 12 L12 14.2 Z", tone: "solid" },
    { d: "M12 2.4 L14.2 12 L12 21.6 L9.8 12 Z", tone: "solid" },
  ],
  "three-figures": [
    { d: "M3.9 9.4 A1.7 1.7 0 1 0 7.3 9.4 A1.7 1.7 0 1 0 3.9 9.4 Z", tone: "tint" },
    { d: "M2.6 20.6 V19.4 A3 3 0 0 1 8.6 19.4 V20.6 Z", tone: "tint" },
    { d: "M16.7 9.4 A1.7 1.7 0 1 0 20.1 9.4 A1.7 1.7 0 1 0 16.7 9.4 Z", tone: "tint" },
    { d: "M15.4 20.6 V19.4 A3 3 0 0 1 21.4 19.4 V20.6 Z", tone: "tint" },
    { d: "M9.9 8.6 A2.1 2.1 0 1 0 14.1 8.6 A2.1 2.1 0 1 0 9.9 8.6 Z", tone: "solid" },
    { d: "M7.9 20.6 V19 A4.1 4.1 0 0 1 16.1 19 V20.6 Z", tone: "solid" },
  ],
  "clasped-hands": [
    { d: "M5.8 8.6 A2.3 2.3 0 1 0 10.4 8.6 A2.3 2.3 0 1 0 5.8 8.6 Z", tone: "tint" },
    { d: "M3 20.4 V18.9 A5.1 5.1 0 0 1 13.2 18.9 V20.4 Z", tone: "tint" },
    { d: "M13.2 9.4 A2.5 2.5 0 1 0 18.2 9.4 A2.5 2.5 0 1 0 13.2 9.4 Z", tone: "solid" },
    { d: "M10.2 20.4 V18.6 A5.5 5.5 0 0 1 21.2 18.6 V20.4 Z", tone: "solid" },
  ],
  "camera-shutter": [
    { d: "M2.4 8.8 A1.8 1.8 0 0 1 4.2 7 H7.2 L8.8 4.6 H15.2 L16.8 7 H19.8 A1.8 1.8 0 0 1 21.6 8.8 V18.2 A1.8 1.8 0 0 1 19.8 20 H4.2 A1.8 1.8 0 0 1 2.4 18.2 Z", tone: "solid" },
    { d: "M8 13.4 A4 4 0 1 0 16 13.4 A4 4 0 1 0 8 13.4 Z", tone: "tint" },
    { d: "M10.2 13.4 A1.8 1.8 0 1 0 13.8 13.4 A1.8 1.8 0 1 0 10.2 13.4 Z", tone: "solid" },
  ],
  "spark-heart": [
    { d: "M11.4 20.6 C11.4 20.6 3 15.2 3 9.8 A4.5 4.5 0 0 1 11.4 7.6 A4.5 4.5 0 0 1 19.8 9.8 C19.8 15.2 11.4 20.6 11.4 20.6 Z", tone: "solid" },
    { d: "M19 2.2 L19.9 4.3 L22 5.2 L19.9 6.1 L19 8.2 L18.1 6.1 L16 5.2 L18.1 4.3 Z", tone: "tint" },
  ],
  "laurel-cup": [
    { d: "M7 6 H17 V9.5 A5 5 0 0 1 7 9.5 Z", tone: "tint" },
    { d: "M6.4 4 H17.6 A1 1 0 0 1 17.6 6 H6.4 A1 1 0 0 1 6.4 4 Z", tone: "solid" },
    { d: "M11 13.2 H13 V18 H11 Z", tone: "solid" },
    { d: "M8 18 H16 A1 1 0 0 1 16 20 H8 A1 1 0 0 1 8 18 Z", tone: "solid" },
    { d: "M7 6.4 H5.2 A3.4 3.4 0 0 0 8.4 11.4 V9.3 A1.5 1.5 0 0 1 7 7.9 Z", tone: "solid" },
    { d: "M17 6.4 H18.8 A3.4 3.4 0 0 1 15.6 11.4 V9.3 A1.5 1.5 0 0 0 17 7.9 Z", tone: "solid" },
  ],
  "podium-steps": [
    { d: "M2.6 12.4 H8.6 V20.6 H2.6 Z", tone: "tint" },
    { d: "M15.4 14.8 H21.4 V20.6 H15.4 Z", tone: "tint" },
    { d: "M8.6 8.6 H15.4 V20.6 H8.6 Z", tone: "solid" },
    { d: "M12 2.2 L12.62 3.95 L14.47 4 L13 5.12 L13.53 6.9 L12 5.85 L10.47 6.9 L11 5.12 L9.53 4 L11.38 3.95 Z", tone: "solid" },
  ],
  hourglass: [
    { d: "M6.6 5.4 H17.4 L12 12 Z", tone: "tint" },
    { d: "M6.6 18.6 H17.4 L12 12 Z", tone: "tint" },
    { d: "M4.8 3 H19.2 V5.4 H4.8 Z", tone: "solid" },
    { d: "M4.8 18.6 H19.2 V21 H4.8 Z", tone: "solid" },
    { d: "M9.4 7.6 H14.6 L12 10.8 Z", tone: "solid" },
    { d: "M8.8 16.6 H15.2 L12 13.4 Z", tone: "solid" },
  ],
  "flame-steady": [
    { d: "M12 2.4 C13.6 6.6 18 8.6 18 13.4 A6 6 0 0 1 6 13.4 C6 10.4 8.2 8.6 9.4 6.2 C10 8.4 10.8 9.4 11.4 9.4 C12.2 9.4 12.6 6.6 12 2.4 Z", tone: "solid" },
    { d: "M12 12 C12.8 14 14.4 15 14.4 16.6 A2.4 2.4 0 0 1 9.6 16.6 C9.6 15 11.2 14 12 12 Z", tone: "tint" },
  ],
  "signal-flag": [
    { d: "M4.8 2.8 H6.8 V21.2 H4.8 Z", tone: "solid" },
    { d: "M6.8 4 L18.8 8.4 L6.8 12.8 Z", tone: "tint" },
  ],
  "first-drop": [
    { d: "M12 2.8 C12 2.8 5.4 10.4 5.4 14.8 A6.6 6.6 0 0 0 18.6 14.8 C18.6 10.4 12 2.8 12 2.8 Z", tone: "solid" },
    { d: "M12 8 C12 8 8.4 12.2 8.4 14.8 A3.6 3.6 0 0 0 15.6 14.8 C15.6 12.2 12 8 12 8 Z", tone: "tint" },
  ],
  "sunrise-gate": [
    { d: "M12 2.6 L15.6 7.2 H8.4 Z", tone: "solid" },
    { d: "M6.4 17.4 A5.6 5.6 0 0 1 17.6 17.4 Z", tone: "tint" },
    { d: "M2.6 17.4 H21.4 V19.4 H2.6 Z", tone: "solid" },
  ],
  "sunset-gate": [
    { d: "M12 7.2 L8.4 2.6 H15.6 Z", tone: "solid" },
    { d: "M6.4 17.4 A5.6 5.6 0 0 1 17.6 17.4 Z", tone: "tint" },
    { d: "M2.6 17.4 H21.4 V19.4 H2.6 Z", tone: "solid" },
  ],
  "double-sun": [
    { d: "M11.4 15.4 A4.4 4.4 0 1 0 20.2 15.4 A4.4 4.4 0 1 0 11.4 15.4 Z", tone: "tint" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(45 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(90 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(135 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(180 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(225 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(270 9.4 9.4)" },
    { d: "M8.6 2.6 H10.2 V5.4 H8.6 Z", tone: "solid", transform: "rotate(315 9.4 9.4)" },
    { d: "M6.2 9.4 A3.2 3.2 0 1 0 12.6 9.4 A3.2 3.2 0 1 0 6.2 9.4 Z", tone: "solid" },
  ],
  "wiesn-crown": [
    { d: "M3.6 18.2 L2.8 7.6 L7.6 11.4 L12 5 L16.4 11.4 L21.2 7.6 L20.4 18.2 Z", tone: "solid" },
    { d: "M3.6 18.2 H20.4 V20.8 H3.6 Z", tone: "solid" },
    { d: "M10.4 14.4 A1.6 1.6 0 1 0 13.6 14.4 A1.6 1.6 0 1 0 10.4 14.4 Z", tone: "tint" },
  ],
  "tent-ring": [
    { d: "M12 8.6 L19 15.8 V19.8 H5 V15.8 Z", tone: "solid" },
    { d: "M10 19.8 V16.8 A2 2 0 0 1 14 16.8 V19.8 Z", tone: "tint" },
    { d: "M12 1.4 L12.76 3.55 L15.04 3.61 L13.24 5 L13.88 7.19 L12 5.9 L10.12 7.19 L10.76 5 L8.96 3.61 L11.24 3.55 Z", tone: "solid" },
  ],
  polaroid: [
    { d: "M4.4 3.4 H19.6 A1.2 1.2 0 0 1 20.8 4.6 V19.4 A1.2 1.2 0 0 1 19.6 20.6 H4.4 A1.2 1.2 0 0 1 3.2 19.4 V4.6 A1.2 1.2 0 0 1 4.4 3.4 Z M5.6 5.6 H18.4 V15.4 H5.6 Z", tone: "solid", fillRule: "evenodd" },
    { d: "M5.6 5.6 H18.4 V15.4 H5.6 Z", tone: "tint" },
    { d: "M5.6 15.4 L9.6 10.2 L12.6 13.8 L15.1 11 L18.4 15.4 Z", tone: "solid" },
    { d: "M14.6 8.2 A1.4 1.4 0 1 0 17.4 8.2 A1.4 1.4 0 1 0 14.6 8.2 Z", tone: "solid" },
  ],
  "banner-pole": [
    { d: "M3.4 2.6 H5.4 V21.4 H3.4 Z", tone: "solid" },
    { d: "M5.4 4.6 H20.6 L17.6 9.6 L20.6 14.6 H5.4 Z", tone: "tint" },
  ],
  "id-card": [
    { d: "M3.6 5 H20.4 A1.6 1.6 0 0 1 22 6.6 V17.4 A1.6 1.6 0 0 1 20.4 19 H3.6 A1.6 1.6 0 0 1 2 17.4 V6.6 A1.6 1.6 0 0 1 3.6 5 Z", tone: "tint" },
    { d: "M5.8 10.4 A2.2 2.2 0 1 0 10.2 10.4 A2.2 2.2 0 1 0 5.8 10.4 Z", tone: "solid" },
    { d: "M4.4 16.2 A3.6 3.6 0 0 1 11.6 16.2 Z", tone: "solid" },
    { d: "M13.4 9.4 H19.2 A0.95 0.95 0 0 1 19.2 11.3 H13.4 A0.95 0.95 0 0 1 13.4 9.4 Z", tone: "solid" },
    { d: "M13.4 13 H17.6 A0.95 0.95 0 0 1 17.6 14.9 H13.4 A0.95 0.95 0 0 1 13.4 13 Z", tone: "solid" },
  ],
  "ribbon-scroll": [
    { d: "M5.6 6.6 H18.4 V17.4 H5.6 Z", tone: "tint" },
    { d: "M4.4 3.2 H19.6 A1.8 1.8 0 0 1 19.6 6.8 H4.4 A1.8 1.8 0 0 1 4.4 3.2 Z", tone: "solid" },
    { d: "M4.4 17.2 H19.6 A1.8 1.8 0 0 1 19.6 20.8 H4.4 A1.8 1.8 0 0 1 4.4 17.2 Z", tone: "solid" },
    { d: "M8 9.6 H16 V11.1 H8 Z", tone: "solid" },
    { d: "M8 12.8 H14 V14.3 H8 Z", tone: "solid" },
  ],
};
