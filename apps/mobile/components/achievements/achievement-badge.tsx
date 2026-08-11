import type { AchievementCategory, AchievementTier, GlyphId } from "@prostcounter/shared/achievements";
import { GLYPH_FALLBACK_ICONS, getCategoryColor, TIER_RING_WIDTH } from "@prostcounter/shared/achievements";
import { cn } from "@prostcounter/ui";
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
} from "lucide-react-native";
import { Image, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { IconColors } from "@/lib/constants/colors";

import { getGlyphImage } from "./glyph-images";

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

/** `xl` exists for the detail sheet's hero badge; the lists use sm..lg. */
type BadgeSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<BadgeSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-24 h-24",
};

interface AchievementBadgeProps {
  glyph: GlyphId;
  category: AchievementCategory;
  tier: AchievementTier;
  isUnlocked: boolean;
  size?: BadgeSize;
}

export function AchievementBadge({
  glyph,
  category,
  tier,
  isUnlocked,
  size = "md",
}: AchievementBadgeProps) {
  const diameter = SIZE_PX[size];
  const strokeWidth = TIER_RING_WIDTH[tier];
  const ringColor = getCategoryColor(category);
  const glowsForTier = tier >= 3;
  const imageSource = getGlyphImage(glyph);
  const FallbackIcon =
    FALLBACK_ICON_COMPONENTS[
      GLYPH_FALLBACK_ICONS[glyph] as keyof typeof FALLBACK_ICON_COMPONENTS
    ] ?? Trophy;

  return (
    <View
      className={cn(
        "items-center justify-center",
        SIZE_CLASSES[size],
        isUnlocked ? "opacity-100" : "opacity-40",
      )}
      style={{
        shadowColor: glowsForTier ? ringColor : undefined,
        shadowOpacity: glowsForTier ? 0.6 : 0,
        shadowRadius: glowsForTier ? 6 : 0,
        elevation: glowsForTier ? 6 : 0,
      }}
    >
      <Svg width={diameter} height={diameter} style={{ position: "absolute" }}>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={(diameter - strokeWidth) / 2}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
      {imageSource ? (
        <Image
          source={imageSource}
          style={{ width: diameter * 0.6, height: diameter * 0.6 }}
          resizeMode="contain"
          alt=""
        />
      ) : (
        <FallbackIcon size={diameter * 0.5} color={IconColors.primary} />
      )}
    </View>
  );
}

AchievementBadge.displayName = "AchievementBadge";
