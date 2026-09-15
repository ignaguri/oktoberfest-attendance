"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 60 * 1000;

/**
 * The current time, refreshed every minute.
 *
 * For date-gated UI that can stay mounted across midnight: a value computed once
 * with `new Date()` would keep offering a festival after it ended.
 */
export function useCurrentDate(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return now;
}
