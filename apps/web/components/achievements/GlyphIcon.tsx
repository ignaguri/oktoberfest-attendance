"use client";

import type { GlyphId } from "@prostcounter/shared/achievements";
import { GLYPH_FALLBACK_ICONS, GLYPH_IDS } from "@prostcounter/shared/achievements";
import Image from "next/image";
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
  glyph: GlyphId;
  sizePx: number;
}

/**
 * Draws an achievement glyph from its PNG in `public/achievements/glyphs`,
 * falling back to a lucide icon for a glyph id the set does not cover (rows
 * written before an id was added still render something).
 *
 * The art carries its own colours, so unlike the vector set this takes no
 * category colour; the badge ring drawn around it still does the category
 * coding.
 */
export function GlyphIcon({ glyph, sizePx }: GlyphIconProps) {
  if (!GLYPHS_WITH_ART.has(glyph)) {
    const FallbackIcon =
      FALLBACK_ICON_COMPONENTS[
        GLYPH_FALLBACK_ICONS[glyph] as keyof typeof FALLBACK_ICON_COMPONENTS
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
    />
  );
}
