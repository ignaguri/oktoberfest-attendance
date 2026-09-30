import { MUG_LOADER } from "@prostcounter/shared/loading";
import { cn } from "@prostcounter/ui";
import {
  Canvas,
  Group,
  Image as SkiaImage,
  useImage,
  usePathValue,
} from "@shopify/react-native-skia";
import { cssInterop } from "nativewind";
import React, { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

cssInterop(Canvas, { className: "style" });

const SIZE = MUG_LOADER.sizePx;
const PERIOD = MUG_LOADER.wavePeriod * SIZE;
const AMPLITUDE = MUG_LOADER.waveAmplitude * SIZE;
const [X1, Y1, X2, Y2] = MUG_LOADER.easing;
const ease = Easing.bezierFn(X1, Y1, X2, Y2);

const EMPTY_SOURCE = require("@/assets/loading/mug-empty.png");
const FULL_SOURCE = require("@/assets/loading/mug-full.png");

/**
 * The filling-mug loader behind `<Spinner size="large" />`. The full mug is
 * drawn over the empty one, clipped below a wavy surface that rises, holds and
 * drains once per loop (timing and geometry in MUG_LOADER). The two PNGs are
 * exported by scripts/glyphs/loader.sh and are pixel aligned.
 */
export function MugLoader({ className }: { className?: string }) {
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

  const surface = usePathValue((builder) => {
    "worklet";
    const p = progress.get();
    const { fullAt, drainAt, emptySurface, fullSurface } = MUG_LOADER;
    // level runs empty -> full -> hold -> empty; drift moves the wave one
    // period while filling and one while draining, so the loop is seamless
    let level: number;
    let drift: number;
    if (p < fullAt) {
      const t = ease(p / fullAt);
      level = emptySurface + (fullSurface - emptySurface) * t;
      drift = t;
    } else if (p < drainAt) {
      level = fullSurface;
      drift = 1;
    } else {
      const t = ease((p - drainAt) / (1 - drainAt));
      level = fullSurface + (emptySurface - fullSurface) * t;
      drift = 1 + t;
    }
    const y = level * SIZE;
    let x = -((drift * PERIOD) % PERIOD) - PERIOD;
    builder.moveTo(x, y);
    while (x < SIZE) {
      builder.quadTo(x + PERIOD / 4, y - 2 * AMPLITUDE, x + PERIOD / 2, y);
      builder.quadTo(x + (3 * PERIOD) / 4, y + 2 * AMPLITUDE, x + PERIOD, y);
      x += PERIOD;
    }
    builder.lineTo(x, SIZE);
    builder.lineTo(-2 * PERIOD, SIZE);
    builder.close();
  });

  if (reduceMotion) {
    return (
      <Canvas className={cn("size-12", className)}>
        {full && <SkiaImage image={full} x={0} y={0} width={SIZE} height={SIZE} fit="contain" />}
      </Canvas>
    );
  }

  return (
    <Canvas className={cn("size-12", className)}>
      {empty && <SkiaImage image={empty} x={0} y={0} width={SIZE} height={SIZE} fit="contain" />}
      <Group clip={surface}>
        {full && <SkiaImage image={full} x={0} y={0} width={SIZE} height={SIZE} fit="contain" />}
      </Group>
    </Canvas>
  );
}
