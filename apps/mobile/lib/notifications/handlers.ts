import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { logger } from "@/lib/logger";

/**
 * Notification data payload structure from Novu
 */
interface NotificationData {
  type?: string;
  groupId?: string;
  achievementId?: string;
  tentId?: string;
  userId?: string;
  reservationId?: string;
  url?: string;
  [key: string]: unknown;
}

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
 * Routes user to appropriate screen based on notification type.
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
) {
  const data = response.notification.request.content.data as NotificationData;

  if (!data) {
    // No data, just open the app
    return;
  }

  // Handle deep linking based on notification type
  switch (data.type) {
    case "group-join":
    case "group-member-joined":
      if (data.groupId) {
        router.push(`/groups/${data.groupId}`);
      } else {
        router.push("/groups");
      }
      break;

    case "achievement-unlocked":
      router.push("/achievements");
      break;

    case "tent-check-in":
    case "group-check-in":
      if (data.groupId) {
        router.push(`/groups/${data.groupId}`);
      } else {
        router.push("/");
      }
      break;

    case "reminder":
      router.push("/");
      break;

    case "reservation-reminder":
    case "reservation-check-in-prompt":
      // Navigate to attendance tab with check-in reservation ID
      if (data.reservationId) {
        router.push(`/attendance?checkInReservationId=${data.reservationId}`);
      } else {
        router.push("/attendance");
      }
      break;

    case "leaderboard-update":
      router.push("/leaderboard");
      break;

    default:
      // If there's a URL, try to navigate to it
      if (data.url && typeof data.url === "string") {
        try {
          // Parse the URL path and navigate
          const urlPath = new URL(data.url).pathname;
          router.push(urlPath as never);
        } catch {
          // Invalid URL, go to home
          router.push("/");
        }
      }
      break;
  }
}

/**
 * Setup notification listeners
 *
 * Returns cleanup function to remove listeners.
 */
export function setupNotificationListeners(): () => void {
  // Listen for notifications received while app is foregrounded
  const notificationReceivedSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      // Notification received in foreground
      // The handler configured above will show it as an alert
      logger.debug("Notification received in foreground:", {
        identifier: notification.request.identifier,
        content: notification.request.content,
      });
    });

  // Listen for user interaction with notification
  const notificationResponseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

  // Return cleanup function
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
