"use client";

import { getGlyphFallbackIcon, GLYPH_IDS } from "@prostcounter/shared/achievements";
import Image from "next/image";
import { useState } from "react";
import {
  Award,
  Beaker,
  Beer,
  Camera,
  CalendarCheck,
  Compass,
  Coins,
  Crown,
  Droplet,
  FerrisWheel,
  Flag,
  Flame,
  GlassWater,
  Handshake,
  Heart,
  Hourglass,
  IdCard,
  Image as ImageIconLucide,
  Link,
  ScrollText,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

const FALLBACK_ICON_COMPONENTS = {
  Award,
  Beaker,
  Beer,
  Camera,
  CalendarCheck,
  Compass,
  Coins,
  Crown,
  Droplet,
  FerrisWheel,
  Flag,
  Flame,
  GlassWater,
  Handshake,
  Heart,
  Hourglass,
  IdCard,
  Image: ImageIconLucide,
  Link,
  ScrollText,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  Trophy,
  Users,
  Wallet,
} as const;

/** Ids we ship art for. `icon` arrives as a plain string from the database. */
const GLYPHS_WITH_ART = new Set<string>(GLYPH_IDS);

interface GlyphIconProps {
  /**
   * Plain string, not GlyphId: achievement rows store `glyph` as text, so an
   * unknown id is a real input this component handles rather than something
   * call sites should cast away.
   */
  glyph: string;
  sizePx: number;
}

/**
 * Draws an achievement glyph from its PNG in `public/achievements/glyphs`,
 * falling back to a lucide icon.
 *
 * Two ways to reach the fallback, and both are needed. An id the set does not
 * cover has no art to load at all (a row written before the id was added still
 * renders something), and that case cannot use the per-glyph mapping, since
 * GLYPH_FALLBACK_ICONS is keyed by GlyphId. Art for a *known* id can also fail
 * at runtime, on a rolling deploy where the PNG is not live yet or when the
 * image optimizer errors; that is the case the mapping is for, and it is why
 * the failure is tracked per glyph rather than as a bare boolean, so one bad
 * asset cannot suppress the art of every later glyph this component renders.
 *
 * The art carries its own colours, so unlike the vector set this takes no
 * category colour; the badge ring drawn around it still does the category
 * coding.
 */
export function GlyphIcon({ glyph, sizePx }: GlyphIconProps) {
  const [failedGlyph, setFailedGlyph] = useState<string | null>(null);

  if (!GLYPHS_WITH_ART.has(glyph) || failedGlyph === glyph) {
    const FallbackIcon =
      FALLBACK_ICON_COMPONENTS[
        getGlyphFallbackIcon(glyph) as keyof typeof FALLBACK_ICON_COMPONENTS
      ] ?? Trophy;
    return <FallbackIcon size={sizePx} />;
  }

  return (
    <Image
      src={`/achievements/glyphs/${glyph}.png`}
      alt=""
      width={sizePx}
      height={sizePx}
      aria-hidden="true"
      onError={() => setFailedGlyph(glyph)}
    />
  );
}
