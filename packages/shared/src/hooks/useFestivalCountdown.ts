import { useEffect, useMemo, useState } from "react";

import {
  type FestivalCountdown,
  type FestivalDates,
  getFestivalCountdown,
} from "../utils/festival-countdown";

const TICK_WHILE_UPCOMING_MS = 1_000;
const TICK_OTHERWISE_MS = 60_000;

/**
 * Live countdown for a festival. Ticks every second before opening and every
 * minute afterwards, since only the day counter changes once it is live.
 */
export function useFestivalCountdown(
  festival: FestivalDates | null | undefined,
): FestivalCountdown | null {
  const [now, setNow] = useState(() => new Date());

  const countdown = useMemo(() => {
    if (!festival) {
      return null;
    }
    return getFestivalCountdown(festival, now);
  }, [festival, now]);

  const phase = countdown?.phase;

  useEffect(() => {
    if (!phase) {
      return;
    }
    const tickMs = phase === "upcoming" ? TICK_WHILE_UPCOMING_MS : TICK_OTHERWISE_MS;
    const intervalId = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(intervalId);
  }, [phase]);

  return countdown;
}
