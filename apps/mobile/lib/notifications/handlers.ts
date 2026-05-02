import { getNotificationRoute } from "@prostcounter/shared/constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

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

/**
 * Handle notification response (user tapped on notification)
 *
 * Routes user to appropriate screen using the shared notification registry.
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, unknown>;

  if (!data) {
    return;
  }

  const route = getNotificationRoute(data);

  if (route) {
    router.push(route as never);
  }
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

  // Listen for user interaction with notification
  const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handleNotificationResponse(response);
    },
  );

  return () => {
    notificationReceivedSubscription.remove();
    notificationResponseSubscription.remove();
  };
}

/**
 * Check for notification that launched the app (cold start)
 *
 * Should be called once when app initializes to handle notifications
 * that were tapped when app was closed.
 */
export async function checkInitialNotification(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();

  if (response) {
    // Small delay to ensure navigation is ready
    setTimeout(() => {
      handleNotificationResponse(response);
    }, 500);
  }
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
