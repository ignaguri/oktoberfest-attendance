import { MUG_LOADER } from "@prostcounter/shared/loading";
import {
  Canvas,
  Group,
  Image as SkiaImage,
  useImage,
  usePathValue,
} from "@shopify/react-native-skia";
import { cssInterop } from "nativewind";
import React, { useEffect } from "react";
import { View } from "react-native";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

cssInterop(Canvas, { className: "style" });

const HALF_DRIFT = MUG_LOADER.waveDriftPeriods / 2;
const [X1, Y1, X2, Y2] = MUG_LOADER.easing;
const ease = Easing.bezierFn(X1, Y1, X2, Y2);

const EMPTY_SOURCE = require("@/assets/loading/mug-empty.png");
const FULL_SOURCE = require("@/assets/loading/mug-full.png");

interface MugLoaderProps {
  /** Box size in points. The art fills about 84% of its height and 63% of its width. */
  size?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * The filling-mug loader for page and section loading. The full mug is drawn
 * over the empty one, clipped below a wavy surface that rises, holds and
 * drains once per loop (timing and geometry in MUG_LOADER). The two PNGs are
 * exported by scripts/glyphs/loader.sh and are pixel aligned. Below ~28pt the
 * fill stops being readable; inline and button loading keeps `Spinner`.
 */
export function MugLoader({
  size = MUG_LOADER.sizePx,
  className,
  "aria-label": ariaLabel = "loading",
}: MugLoaderProps) {
  const reduceMotion = useReducedMotion();
  const empty = useImage(EMPTY_SOURCE);
  const full = useImage(FULL_SOURCE);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    progress.set(
      withRepeat(withTiming(1, { duration: MUG_LOADER.durationMs, easing: Easing.linear }), -1, false),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, reduceMotion]);

  const period = MUG_LOADER.wavePeriod * size;
  const amplitude = MUG_LOADER.waveAmplitude * size;

  const surface = usePathValue((builder) => {
    "worklet";
    const p = progress.get();
    const { fullAt, drainAt, emptySurface, fullSurface } = MUG_LOADER;
    // level runs empty -> full -> hold -> empty; drift moves the wave half of
    // waveDriftPeriods while filling and half while draining, so the loop is
    // seamless
    let level: number;
    let drift: number;
    if (p < fullAt) {
      const t = ease(p / fullAt);
      level = emptySurface + (fullSurface - emptySurface) * t;
      drift = t * HALF_DRIFT;
    } else if (p < drainAt) {
      level = fullSurface;
      drift = HALF_DRIFT;
    } else {
      const t = ease((p - drainAt) / (1 - drainAt));
      level = fullSurface + (emptySurface - fullSurface) * t;
      drift = HALF_DRIFT * (1 + t);
    }
    const y = level * size;
    let x = -((drift * period) % period) - period;
    builder.moveTo(x, y);
    while (x < size) {
      builder.quadTo(x + period / 4, y - 2 * amplitude, x + period / 2, y);
      builder.quadTo(x + (3 * period) / 4, y + 2 * amplitude, x + period, y);
      x += period;
    }
    builder.lineTo(x, size);
    builder.lineTo(-2 * period, size);
    builder.close();
  });

  // Accessibility lives on a plain View: Skia's native view on Android does not
  // expose aria-label/role to TalkBack. The box is sized in points from `size`
  // (a runtime value, so it can't be a class); the Skia drawing uses the same
  // number, so the two always agree.
  return (
    <View
      className={className}
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      aria-label={ariaLabel}
    >
      <Canvas className="flex-1">
        {!reduceMotion && empty && (
          <SkiaImage image={empty} x={0} y={0} width={size} height={size} fit="contain" />
        )}
        <Group clip={reduceMotion ? undefined : surface}>
          {full && <SkiaImage image={full} x={0} y={0} width={size} height={size} fit="contain" />}
        </Group>
      </Canvas>
    </View>
  );
}
