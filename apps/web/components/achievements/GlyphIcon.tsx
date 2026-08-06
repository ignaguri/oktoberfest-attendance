"use client";

import type { GlyphId } from "@prostcounter/shared/achievements";
import { GLYPH_FALLBACK_ICONS } from "@prostcounter/shared/achievements";
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

interface GlyphIconProps {
  glyph: GlyphId;
  sizePx: number;
}

export function GlyphIcon({ glyph, sizePx }: GlyphIconProps) {
  const FallbackIcon =
    FALLBACK_ICON_COMPONENTS[
      GLYPH_FALLBACK_ICONS[glyph] as keyof typeof FALLBACK_ICON_COMPONENTS
    ];
  return <FallbackIcon size={sizePx} />;
}
