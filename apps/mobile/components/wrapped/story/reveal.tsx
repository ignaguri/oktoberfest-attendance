import { REVEAL_STEP_MS } from "@prostcounter/shared/wrapped";
import type { ReactNode } from "react";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

interface RevealProps {
  step: number;
  animate: boolean;
  kind?: "fadeUp" | "fade" | "stamp";
  className?: string;
  children: ReactNode;
}

/** Enters at its step while the slide animates; renders static otherwise. */
export function Reveal({ step, animate, kind = "fadeUp", className, children }: RevealProps) {
  const delay = step * REVEAL_STEP_MS;
  let entering;
  if (animate) {
    if (kind === "stamp") {
      // Same spring as web; Reanimated 4 otherwise defaults to mass 4, stiffness 900
      entering = ZoomIn.delay(delay).springify().mass(1).stiffness(180).damping(20);
    } else if (kind === "fade") {
      entering = FadeIn.delay(delay).duration(300);
    } else {
      entering = FadeInDown.delay(delay).duration(350);
    }
  }
  return (
    <Animated.View entering={entering} className={className}>
      {children}
    </Animated.View>
  );
}
