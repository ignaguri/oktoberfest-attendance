import { Image } from "react-native";

import { getGlyphImage } from "./glyph-images";

interface GlyphProps {
  /** Plain string: ids arrive from the database, so an unknown one is valid input. */
  glyph: string;
  size: number;
}

/**
 * Draws an achievement glyph from its bundled raster.
 *
 * The art carries its own colours, so unlike the vector set this takes no
 * category colour; the badge ring drawn around it still does the category
 * coding. An id with no asset renders nothing — `achievement-badge.tsx`
 * checks the registry first and substitutes a lucide icon.
 */
export function Glyph({ glyph, size }: GlyphProps) {
  const source = getGlyphImage(glyph);

  if (source === undefined) {
    return null;
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      // Decorative: the badge is always accompanied by the achievement name.
      alt=""
      accessibilityIgnoresInvertColors
    />
  );
}

Glyph.displayName = "Glyph";
