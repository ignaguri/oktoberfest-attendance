"use client";

import { createTracker, screenFromWebPath, type Tracker } from "@prostcounter/shared/analytics";
import { TrackerContextProvider } from "@prostcounter/shared/analytics/react";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";

/** Batch building waits for an idle moment so it never competes with input. */
function scheduleWhenIdle(run: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => run(), { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

/**
 * Usage tracking for the (private) area, whose layout already redirects
 * signed-out visitors (see packages/shared/src/analytics). A request without a
 * session is rejected by the API and dropped after one retry, silently.
 *
 * app_opened "cold" per page load, "resume" whenever the tab becomes visible
 * again. Hiding the tab flushes with fetch keepalive, which survives unload
 * (sendBeacon cannot carry the Authorization header).
 */
export function TrackerProvider({ children }: { children: ReactNode }) {
  const [tracker, setTracker] = useState<Tracker | null>(null);

  useEffect(() => {
    const created = createTracker({
      send: (events, options) => apiClient.events.record({ events }, options),
      createSessionId: () => crypto.randomUUID(),
      schedule: scheduleWhenIdle,
    });
    setTracker(created);
    created.track("app_opened", { source: "cold" });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        created.pause();
      } else {
        created.resume();
        created.track("app_opened", { source: "resume" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // A reload or full navigation of a visible tab fires pagehide but no
    // visibilitychange, so flush here too or the last screens are lost.
    const handlePageHide = () => {
      created.flush({ keepalive: true });
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      created.dispose();
    };
  }, []);

  return (
    <TrackerContextProvider tracker={tracker}>
      <ScreenViewTracker tracker={tracker} />
      {children}
    </TrackerContextProvider>
  );
}

function ScreenViewTracker({ tracker }: { tracker: Tracker | null }) {
  const pathname = usePathname();
  const lastScreenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tracker || !pathname) {
      return;
    }
    const screen = screenFromWebPath(pathname);
    if (screen === lastScreenRef.current) {
      return;
    }
    lastScreenRef.current = screen;
    tracker.track("screen_viewed", { screen });
  }, [tracker, pathname]);

  return null;
}
