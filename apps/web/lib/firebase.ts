import { initializeApp } from "firebase/app";
import type { MessagePayload } from "firebase/messaging";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import { logger } from "@/lib/logger";

// Minimal Firebase config for FCM only
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: ReturnType<typeof getMessaging> | null = null;

if (typeof window !== "undefined") {
  messaging = getMessaging(app);
}

/**
 * Get FCM registration token for the current device/browser
 */
export async function getFCMToken(): Promise<string | null> {
  if (!messaging) {
    logger.debug(
      "Firebase messaging not available (SSR context)",
      logger.clientComponent("firebase"),
    );
    return null;
  }

  try {
    // Get registration token (Firebase will handle service worker registration)
    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (currentToken) {
      return currentToken;
    } else {
      return null;
    }
  } catch (err) {
    logger.error(
      "Failed to retrieve FCM token",
      logger.clientComponent("firebase"),
      err as Error,
    );
    return null;
  }
}

/**
 * Listen for FCM messages when the app is in the foreground
 */
export function onMessageListener(): Promise<MessagePayload> {
  return new Promise((resolve) => {
    if (!messaging) {
      logger.debug(
        "Firebase messaging not available for onMessage listener",
        logger.clientComponent("firebase"),
      );
      return;
    }

    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}

export { app, messaging };
