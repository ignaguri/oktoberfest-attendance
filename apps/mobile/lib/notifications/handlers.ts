import { getNotificationRoute } from "@prostcounter/shared/constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

import { logger } from "@/lib/logger";

/**
 * Configure notification handler for foreground notifications
 *
 * This determines how notifications behave when received while app is in foreground.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Directories under app/(tabs)/
const TAB_ROUTES = new Set(["home", "attendance", "groups", "leaderboard", "profile"]);

/**
 * Route to the screen a notification points at, from a push tap or the inbox.
 *
 * A tab route opened from a screen above (tabs), such as the inbox, would stack
 * a second (tabs) navigator with push or navigate (React Navigation 7 only
 * reuses the current route), so it unwinds to the existing one instead. (tabs)
 * is always the bottom of the root stack, so dismissTo always finds it. Other
 * routes use navigate, which reuses the screen when it is the one already open
 * (a friend request tapped on /friends) and pushes otherwise.
 */
export function navigateToNotificationRoute(payload: Record<string, unknown>) {
  const route = getNotificationRoute(payload);

  if (!route) {
    return;
  }

  const firstSegment = route.split(/[/?#]/)[1];

  if (TAB_ROUTES.has(firstSegment)) {
    router.dismissTo(route as never);
  } else {
    router.navigate(route as never);
  }
}

// The launch response can reach us twice: through getLastNotificationResponse
// and through the response listener
let lastHandledResponseKey: string | null = null;

/**
 * Handle notification response (user tapped on notification)
 */
function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;

  if (responseKey === lastHandledResponseKey) {
    return;
  }
  lastHandledResponseKey = responseKey;

  // Native keeps the last response across JS reloads (e.g. applying an OTA
  // update), so an uncleared one would navigate again on the next launch
  Notifications.clearLastNotificationResponse();

  const data = response.notification.request.content.data as Record<string, unknown>;

  if (!data) {
    return;
  }

  navigateToNotificationRoute(data);
}

/**
 * Setup notification listeners
 *
 * Returns cleanup function to remove listeners.
 */
export function setupNotificationListeners(): () => void {
  // Listen for notifications received while app is foregrounded
  const notificationReceivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      logger.debug("Notification received in foreground:", {
        identifier: notification.request.identifier,
        content: notification.request.content,
      });
    },
  );

  return () => {
    notificationReceivedSubscription.remove();
  };
}

/**
 * Navigate on notification taps, including the one that launched the app.
 *
 * Only subscribes once `canNavigate` is true, so a tap that arrives while the
 * app is still booting or signed out waits for the router instead of racing it.
 * The pending tap stays in getLastNotificationResponse until then.
 */
export function useNotificationResponseNavigation(canNavigate: boolean) {
  useEffect(() => {
    if (!canNavigate) {
      return;
    }

    const launchResponse = Notifications.getLastNotificationResponse();

    if (launchResponse) {
      handleNotificationResponse(launchResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    return () => {
      subscription.remove();
    };
  }, [canNavigate]);
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Dismiss all notifications
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
