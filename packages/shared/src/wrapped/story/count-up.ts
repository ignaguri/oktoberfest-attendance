import { useEffect, useState } from "react";

// packages/shared has no DOM lib; web and React Native both provide these globally.
declare function requestAnimationFrame(callback: (timestamp: number) => void): number;
declare function cancelAnimationFrame(handle: number): void;

/** Ease-out cubic from 0 to target over durationMs. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }
  if (elapsedMs >= durationMs) {
    return target;
  }
  const progress = elapsedMs / durationMs;
  return target * (1 - (1 - progress) ** 3);
}

/**
 * The number to display: counts up while animating, the target otherwise.
 * delayMs holds it at 0 first, for a number that reveals a few steps in.
 */
export function useCountUp(target: number, animate: boolean, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    const startedAt = Date.now();
    let frameId = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - startedAt - delayMs;
      setValue(countUpValue(target, elapsed, durationMs));
      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(tick);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [animate, target, durationMs, delayMs]);

  return value;
}
