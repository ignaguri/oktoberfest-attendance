import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_TIMEZONE } from "@prostcounter/shared/constants";
import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  buildLiveActivityState,
  formatDateForDatabase,
  isLiveActivityStale,
} from "@prostcounter/shared/utils";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { API_BASE_URL, apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useAdaptedAttendanceByDate,
  useAdaptedConsumptionsByDate,
} from "@/lib/database/adapted-hooks";
import { useOfflineReady, useOfflineSafe } from "@/lib/database/offline-provider";
import { logger } from "@/lib/logger";
import { useNotificationContextSafe } from "@/lib/notifications/NotificationContext";
import { LiveActivity } from "@/modules/live-activity";

import { runSerialized } from "./android-tap";
import { registerLiveActivityTask } from "./android-task";
import { decideLiveActivity } from "./decide";
import { buildAndroidLabels } from "./labels";
import { logPendingTap } from "./log-tap";
import { mergeWithRunningState } from "./merge";
import { forgetRegisteredToken, REGISTERED_TOKEN_KEY, registerAndroidToken } from "./registered-token";
import { replayPendingTaps } from "./replay";
import { useLiveActivitySetting } from "./setting";

// Android's native surface and pending store share the headless "+1" task's chain.
function serialized<T>(work: () => Promise<T>): Promise<T> {
  return Platform.OS === "android" ? runSerialized(work) : work();
}

export function LiveActivityController() {
  const { t } = useTranslation();
  const { session, isLoading: authLoading } = useAuth();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const { enabled, loaded: settingLoaded } = useLiveActivitySetting();
  const offlineReady = useOfflineReady();
  const { sync: syncOffline } = useOfflineSafe();
  const syncOfflineRef = useRef(syncOffline);
  const { expoPushToken } = useNotificationContextSafe();
  const [now, setNow] = useState(() => new Date());
  const [syncRequest, setSyncRequest] = useState(0);
  const syncing = useRef(false);
  const rerun = useRef(false);

  const timezone = currentFestival?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatDateForDatabase(now, timezone);
  const festivalId = currentFestival?.id;
  const { data: attendance, loading: attendanceLoading } = useAdaptedAttendanceByDate(festivalId, today);
  const { data: consumptions, loading: consumptionsLoading } = useAdaptedConsumptionsByDate(festivalId, today);

  // Wait for every input; acting on half-loaded data would end and restart the surface.
  const queriesSettled =
    !session || !festivalId || (offlineReady && !attendanceLoading && !consumptionsLoading);
  const inputsReady = !authLoading && !festivalLoading && settingLoaded && queriesSettled;

  useEffect(() => {
    syncOfflineRef.current = syncOffline;
  }, [syncOffline]);

  // Re-evaluate on every return to the foreground (day rollover, staleness).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(new Date());
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void registerLiveActivityTask().catch((error) =>
      logger.error("[LiveActivity] task registration", error),
    );
  }, []);

  // iOS: register each (rotating) per-activity token.
  useEffect(() => {
    const subscription = LiveActivity.addPushTokenListener(async (info) => {
      const running = await LiveActivity.getRunningAttributes();
      if (!running) {
        return;
      }
      // A rotated token replaces the old one; its row would otherwise get pushes all day.
      const previous = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
      if (previous && previous !== info.token) {
        await apiClient.liveActivity.deleteToken(previous).catch(() => {});
      }
      await apiClient.liveActivity
        .registerToken({
          platform: "ios",
          token: info.token,
          apnsEnvironment: info.apnsEnvironment,
          festivalId: running.festivalId,
          date: running.date,
        })
        .then(() => AsyncStorage.setItem(REGISTERED_TOKEN_KEY, info.token))
        .catch((error) => logger.error("[LiveActivity] token registration", error));
    });
    return () => subscription.remove();
  }, []);

  // Replay taps saved while offline.
  useEffect(() => {
    if (!session) {
      return;
    }
    const userId = session.user.id;
    const replay = () =>
      replayPendingTaps({
        userId,
        peek: () => LiveActivity.peekPendingTaps(),
        remove: (ids) => LiveActivity.removePendingTaps(ids),
        logDrink: logPendingTap,
      });
    void serialized(replay)
      .then(async ({ sent }) => {
        // Replayed drinks only reach local SQLite through a pull.
        if (sent > 0) {
          await syncOfflineRef.current({ direction: "pull" });
        }
      })
      .catch((error) => logger.error("[LiveActivity] replay", error));
  }, [session, now]);

  useEffect(() => {
    if (!inputsReady) {
      return;
    }
    // One sync at a time; a change during a sync triggers one more afterwards.
    if (syncing.current) {
      rerun.current = true;
      return;
    }
    syncing.current = true;

    const run = async () => {
      // A background render (headless task, push-woken JS) must not start or end the surface.
      if (AppState.currentState !== "active") {
        return;
      }
      const localState = buildLiveActivityState({
        attendance: attendance ?? null,
        consumptions: consumptions ?? [],
      });
      const running = await LiveActivity.getRunningAttributes();
      const sameDay = running?.festivalId === festivalId && running?.date === today;
      const state = sameDay
        ? mergeWithRunningState(localState, await LiveActivity.getRunningState())
        : localState;
      const action = decideLiveActivity({
        supported: await LiveActivity.isSupported(),
        enabled,
        signedIn: Boolean(session),
        festival: currentFestival
          ? {
              id: currentFestival.id,
              startDate: currentFestival.startDate,
              endDate: currentFestival.endDate,
            }
          : null,
        today,
        hasState: state !== null,
        stale: state ? isLiveActivityStale(state, { date: today, timezone }, now) : true,
        running: running ? { festivalId: running.festivalId, date: running.date } : null,
      });

      if (action === "end" || action === "restart") {
        await serialized(() => LiveActivity.end());
        await forgetRegisteredToken();
      }
      if ((action === "start" || action === "restart") && state && currentFestival && session) {
        await serialized(() =>
          LiveActivity.start(
            {
              festivalId: currentFestival.id,
              festivalName: currentFestival.name,
              date: today,
              timezone,
              apiBaseUrl: `${API_BASE_URL}/v1`,
            },
            state,
            buildAndroidLabels(t),
            session.user.id,
          ),
        );
        if (Platform.OS === "android" && expoPushToken) {
          await registerAndroidToken(expoPushToken, currentFestival.id, today);
        }
      }
      if (action === "update" && state) {
        // Re-read inside the chain: a tap may have landed since the read above. Merge from
        // localState, not state, so a push that lowered the count isn't undone.
        await serialized(async () =>
          LiveActivity.update(
            mergeWithRunningState(localState, await LiveActivity.getRunningState()) ?? state,
          ),
        );
        // The push token may not have been ready when the surface started.
        if (
          Platform.OS === "android" &&
          expoPushToken &&
          currentFestival &&
          (await AsyncStorage.getItem(REGISTERED_TOKEN_KEY)) !== expoPushToken
        ) {
          await registerAndroidToken(expoPushToken, currentFestival.id, today);
        }
      }
    };

    run()
      .catch((error) => logger.error("[LiveActivity] sync failed", error))
      .finally(() => {
        syncing.current = false;
        if (rerun.current) {
          rerun.current = false;
          setSyncRequest((count) => count + 1);
        }
      });
  }, [
    inputsReady,
    attendance,
    consumptions,
    enabled,
    session,
    currentFestival,
    festivalId,
    today,
    timezone,
    now,
    expoPushToken,
    t,
    syncRequest,
  ]);

  return null;
}
