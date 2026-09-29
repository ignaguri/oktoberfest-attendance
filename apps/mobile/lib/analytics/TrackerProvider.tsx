import { createTracker, screenFromSegments, type Tracker } from "@prostcounter/shared/analytics";
import { TrackerContextProvider } from "@prostcounter/shared/analytics/react";
import { randomUUID } from "expo-crypto";
import { useSegments } from "expo-router";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/AuthContext";

import { isScreenViewDue } from "./screen-events";

/**
 * Usage tracking for the signed-in user (see packages/shared/src/analytics).
 *
 * One tracker per signed-in user: a user change disposes the old one, so a
 * queued batch never goes out under the next account. Signed out, the context
 * holds the no-op tracker. The tracker is created inside the effect (not in
 * useMemo) so a StrictMode double run creates a fresh one instead of reusing a
 * disposed one.
 *
 * Lifecycle: app_opened "cold" when the tracker starts (app launch or sign-in),
 * "resume" on every return to the foreground. Backgrounding flushes with
 * keepalive and starts the 30-minute session clock. iOS may suspend the app
 * before that flush finishes; those events are lost, which is accepted.
 */
/**
 * The screen the user is actually on, as a route template. Read at the root:
 * inside a screen, useSegments() returns that screen's own route even while it
 * sits unseen in a background tab.
 */
const CurrentScreenContext = createContext<string | null>(null);

export function useCurrentScreen(): string | null {
  return useContext(CurrentScreenContext);
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const screen = screenFromSegments(useSegments());
  const userId = user?.id ?? null;
  const [tracker, setTracker] = useState<Tracker | null>(null);

  useEffect(() => {
    if (!userId) {
      setTracker(null);
      return;
    }
    const created = createTracker({
      // No keepalive on mobile: React Native's fetch ignores it, and it would
      // make the client reuse cached auth headers instead of the live session.
      send: (events) => apiClient.events.record({ events }),
      createSessionId: randomUUID,
    });
    setTracker(created);
    created.track("app_opened", { source: "cold" });

    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        created.pause();
      } else if (nextState === "active" && previousState === "background") {
        created.resume();
        created.track("app_opened", { source: "resume" });
      }
      previousState = nextState;
    });

    return () => {
      subscription.remove();
      created.dispose();
    };
  }, [userId]);

  return (
    <TrackerContextProvider tracker={tracker}>
      <CurrentScreenContext.Provider value={screen}>
        <ScreenViewTracker tracker={tracker} screen={screen} />
        {children}
      </CurrentScreenContext.Provider>
    </TrackerContextProvider>
  );
}

/** screen_viewed on every route change, as a route template ("/group-detail/[id]"). */
function ScreenViewTracker({ tracker, screen }: { tracker: Tracker | null; screen: string }) {
  const lastViewRef = useRef<{ tracker: Tracker; screen: string } | null>(null);

  useEffect(() => {
    if (!tracker || !isScreenViewDue(lastViewRef.current, tracker, screen)) {
      return;
    }
    lastViewRef.current = { tracker, screen };
    tracker.track("screen_viewed", { screen });
  }, [tracker, screen]);

  return null;
}
