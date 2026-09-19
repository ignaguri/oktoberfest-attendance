import { useCanShowLaunchPopups } from "@prostcounter/shared/contexts";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, Platform } from "react-native";

import { NotificationAskDialog } from "@/components/notifications/NotificationAskDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { getContextualAskState, recordContextualAskDecline } from "@/lib/auth/secure-storage";
import { logger } from "@/lib/logger";
import {
  CONTEXTUAL_ASK_OPEN_DELAY_MS,
  type NotificationAskTrigger,
  runContextualAskPrimary,
} from "@/lib/notifications/contextual-ask";
import { useNotificationContextSafe } from "@/lib/notifications/NotificationContext";
import { shouldShowContextualAsk } from "@/lib/notifications/push-registration-rules";
import { usePushRegistration } from "@/lib/notifications/usePushRegistration";

interface NotificationAskContextValue {
  ask: (trigger: NotificationAskTrigger) => void;
}

const NotificationAskContext = createContext<NotificationAskContextValue | null>(null);

const NOOP_ASK: NotificationAskContextValue = {
  ask: () => {},
};

/** Outside the provider (tests, isolated screens) asking is a no-op. */
export function useNotificationAsk(): NotificationAskContextValue {
  return useContext(NotificationAskContext) ?? NOOP_ASK;
}

async function openDeviceSettings(): Promise<void> {
  if (Platform.OS === "ios") {
    await Linking.openURL("app-settings:");
    return;
  }
  await Linking.openSettings();
}

/**
 * Offers notifications right after a friend request, day plan or group join.
 * At most once per app session, never within 7 days of a decline, and never
 * again after 3 declines (see shouldShowContextualAsk).
 */
export function NotificationAskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { permissionStatus, isPermissionLoading, requestPermission } = useNotificationContextSafe();
  const { register } = usePushRegistration();
  const canShowLaunchPopups = useCanShowLaunchPopups();

  const [openTrigger, setOpenTrigger] = useState<NotificationAskTrigger | null>(null);
  const hasAskedThisSessionRef = useRef(false);
  const openTimerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ask() runs from mutation callbacks and a timer, after renders it did not see,
  // so it reads current values from this ref instead of closing over stale ones.
  const latestRef = useRef({ userId, permissionStatus, isPermissionLoading, canShowLaunchPopups });
  useEffect(() => {
    latestRef.current = { userId, permissionStatus, isPermissionLoading, canShowLaunchPopups };
  });

  useEffect(() => {
    return () => {
      if (openTimerIdRef.current !== null) {
        clearTimeout(openTimerIdRef.current);
      }
    };
  }, []);

  const ask = useCallback((trigger: NotificationAskTrigger) => {
    const requestingUserId = latestRef.current.userId;
    if (!requestingUserId || hasAskedThisSessionRef.current || openTimerIdRef.current !== null) {
      return;
    }

    getContextualAskState(requestingUserId)
      .then((state) => {
        const latest = latestRef.current;
        const isAllowed = shouldShowContextualAsk({
          permissionStatus: latest.permissionStatus,
          isPermissionLoading: latest.isPermissionLoading,
          isWeb: Platform.OS === "web",
          declineCount: state.declineCount,
          lastDeclinedAt: state.lastDeclinedAt ? new Date(state.lastDeclinedAt) : null,
          hasAskedThisSession: hasAskedThisSessionRef.current,
          now: new Date(),
        });
        if (!isAllowed || openTimerIdRef.current !== null) {
          return;
        }

        openTimerIdRef.current = setTimeout(() => {
          openTimerIdRef.current = null;
          const current = latestRef.current;
          // Another popup (update, What's New) is showing, or the user changed:
          // drop this ask without counting it, the next trigger can try again.
          if (
            hasAskedThisSessionRef.current ||
            !current.canShowLaunchPopups ||
            current.userId !== requestingUserId
          ) {
            return;
          }
          hasAskedThisSessionRef.current = true;
          setOpenTrigger(trigger);
        }, CONTEXTUAL_ASK_OPEN_DELAY_MS);
      })
      .catch((error) => {
        logger.error("[NotificationAsk] Failed to read ask state", error);
      });
  }, []);

  const recordDecline = useCallback(async () => {
    if (!userId) {
      return;
    }
    await recordContextualAskDecline(userId, new Date());
  }, [userId]);

  const handleNotNow = useCallback(async () => {
    setOpenTrigger(null);
    try {
      await recordDecline();
    } catch (error) {
      logger.error("[NotificationAsk] Failed to record decline", error);
    }
  }, [recordDecline]);

  const handlePrimary = useCallback(async () => {
    setOpenTrigger(null);
    try {
      await runContextualAskPrimary({
        permissionStatus,
        requestPermission,
        register: () => register(),
        openSettings: openDeviceSettings,
        recordDecline,
      });
    } catch (error) {
      logger.error("[NotificationAsk] Failed to enable notifications", error);
    }
  }, [permissionStatus, requestPermission, register, recordDecline]);

  const value = useMemo(() => ({ ask }), [ask]);

  return (
    <NotificationAskContext.Provider value={value}>
      {children}
      <NotificationAskDialog
        trigger={openTrigger}
        permissionStatus={permissionStatus}
        onPrimary={handlePrimary}
        onNotNow={handleNotNow}
      />
    </NotificationAskContext.Provider>
  );
}
