import * as Notifications from "expo-notifications";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  clearFCMToken,
  getNotificationPermissionStatus,
  getStoredFCMToken,
  hasNotificationPromptBeenShown,
  type NotificationPermissionStatus,
  setNotificationPermissionStatus,
  setNotificationPromptShown,
  storeFCMToken as saveExpoPushToken,
} from "@/lib/auth/secure-storage";
import { logger } from "@/lib/logger";

/**
 * Expo Project ID for push tokens
 * This should be set in your EAS project configuration
 */
const EXPO_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

/**
 * Notification Context Type
 */
interface NotificationContextType {
  // Permission state
  permissionStatus: NotificationPermissionStatus;
  hasPromptBeenShown: boolean;
  isPermissionLoading: boolean;

  // Push token state (Expo Push Token)
  expoPushToken: string | null;
  isTokenLoading: boolean;

  // Registration state (isRegistered means registered with Novu, not just token obtained)
  isRegistered: boolean;
  isRegistering: boolean;

  // Actions
  requestPermission: () => Promise<boolean>;
  markPromptAsShown: () => Promise<void>;
  registerForPushNotifications: (userProfile?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }) => Promise<string | null>;
  markAsRegisteredWithNovu: () => void;
  clearNotificationState: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

/**
 * Notification Provider
 *
 * Manages notification permissions, Expo push tokens, and Novu registration.
 * Uses Expo Push Notifications (not FCM) for simpler setup.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Permission state
  const [permissionStatus, setPermissionStatusState] =
    useState<NotificationPermissionStatus>("undetermined");
  const [hasPromptBeenShown, setHasPromptBeenShown] = useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  // Push token state (Expo Push Token)
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(true);

  // Registration state
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  /**
   * Get Expo push token
   */
  const getExpoPushToken = useCallback(async (): Promise<string | null> => {
    try {
      // Validate EXPO_PROJECT_ID is set before attempting to get token
      if (!EXPO_PROJECT_ID) {
        logger.error(
          "EXPO_PUBLIC_EAS_PROJECT_ID is not set. Cannot get push token.",
        );
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });

      return tokenData.data;
    } catch (error) {
      logger.error("Error getting Expo push token:", error);
      return null;
    }
  }, []);

  /**
   * Load initial notification state from storage and sync with device permission
   */
  useEffect(() => {
    async function loadNotificationState() {
      try {
        const [promptShown, storedStatus, storedToken] = await Promise.all([
          hasNotificationPromptBeenShown(),
          getNotificationPermissionStatus(),
          getStoredFCMToken(), // Legacy name, but stores Expo push token now
        ]);

        setHasPromptBeenShown(promptShown);
        if (storedToken) {
          setExpoPushToken(storedToken);
          // Note: Don't auto-set isRegistered - this only means we have a token locally
          // The token may not have been successfully registered with Novu
          // isRegistered should only be set after successful Novu registration
        }

        // Check actual device permission status and sync with stored state
        const { status: deviceStatus } =
          await Notifications.getPermissionsAsync();

        // Map expo permission status to our status type
        let actualStatus: NotificationPermissionStatus = "undetermined";
        if (deviceStatus === "granted") {
          actualStatus = "granted";
        } else if (deviceStatus === "denied") {
          actualStatus = "denied";
        }

        // If device status differs from stored status, use device status (source of truth)
        if (actualStatus !== storedStatus) {
          logger.debug(
            `Syncing permission status: stored=${storedStatus}, device=${actualStatus}`,
          );
          setPermissionStatusState(actualStatus);
          await setNotificationPermissionStatus(actualStatus);
        } else if (storedStatus) {
          setPermissionStatusState(storedStatus);
        } else {
          setPermissionStatusState(actualStatus);
        }

        // If permission is granted but no token stored, try to get one
        if (actualStatus === "granted" && !storedToken) {
          logger.debug(
            "Permission granted but no token, attempting to get Expo push token...",
          );
          const token = await getExpoPushToken();
          if (token) {
            await saveExpoPushToken(token);
            setExpoPushToken(token);
            // Note: Don't auto-set isRegistered - token obtained but not registered with Novu yet
            logger.debug("Successfully obtained and stored Expo push token:", {
              tokenPreview: token.substring(0, 30) + "...",
            });
          }
        }
      } catch (error) {
        logger.error("Error loading notification state:", error);
      } finally {
        setIsPermissionLoading(false);
        setIsTokenLoading(false);
      }
    }

    loadNotificationState();
  }, [getExpoPushToken]);

  /**
   * Mark the permission prompt as shown
   */
  const markPromptAsShown = useCallback(async () => {
    await setNotificationPromptShown(true);
    setHasPromptBeenShown(true);
  }, []);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Mark prompt as shown first
      await markPromptAsShown();

      // Request permission
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      if (existingStatus === "granted") {
        setPermissionStatusState("granted");
        await setNotificationPermissionStatus("granted");
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();

      if (status === "granted") {
        setPermissionStatusState("granted");
        await setNotificationPermissionStatus("granted");
        return true;
      }

      setPermissionStatusState("denied");
      await setNotificationPermissionStatus("denied");
      return false;
    } catch (error) {
      logger.error("Error requesting notification permission:", error);
      setPermissionStatusState("denied");
      await setNotificationPermissionStatus("denied");
      return false;
    }
  }, [markPromptAsShown]);

  /**
   * Register for push notifications
   *
   * Gets the Expo push token for use with Novu's Expo push provider.
   * Note: This only obtains the local token - actual registration with Novu
   * happens in the notifications settings screen via API hooks.
   *
   * @returns The Expo push token if successful, null if failed
   */
  const registerForPushNotifications = useCallback(
    async (_userProfile?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    }): Promise<string | null> => {
      if (permissionStatus !== "granted") {
        logger.warn(
          "Cannot register for push notifications without permission",
        );
        return null;
      }

      setIsRegistering(true);

      try {
        // Get Expo push token
        const token = await getExpoPushToken();

        if (!token) {
          logger.error("Failed to get Expo push token");
          return null;
        }

        logger.debug("Expo push token obtained:", {
          tokenPreview: token.substring(0, 30) + "...",
        });

        // Store token locally
        await saveExpoPushToken(token);
        setExpoPushToken(token);

        // Note: Don't set isRegistered here - this function only obtains the local token
        // The actual registration with Novu happens in the notifications settings screen
        // isRegistered should be set after successful Novu registration

        return token;
      } catch (error) {
        logger.error("Error registering for push notifications:", error);
        return null;
      } finally {
        setIsRegistering(false);
      }
    },
    [permissionStatus, getExpoPushToken],
  );

  /**
   * Mark as registered with Novu
   * Call this after successful Novu subscriber and token registration
   */
  const markAsRegisteredWithNovu = useCallback(() => {
    setIsRegistered(true);
  }, []);

  /**
   * Clear all notification state
   */
  const clearNotificationState = useCallback(async () => {
    await clearFCMToken(); // Legacy name, clears Expo push token
    setExpoPushToken(null);
    setIsRegistered(false);
  }, []);

  const value: NotificationContextType = {
    // Permission state
    permissionStatus,
    hasPromptBeenShown,
    isPermissionLoading,

    // Push token state (Expo Push Token)
    expoPushToken,
    isTokenLoading,

    // Registration state
    isRegistered,
    isRegistering,

    // Actions
    requestPermission,
    markPromptAsShown,
    registerForPushNotifications,
    markAsRegisteredWithNovu,
    clearNotificationState,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification context
 */
export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider",
    );
  }
  return context;
}

/**
 * Default context for use outside NotificationProvider (e.g., on auth screens)
 */
const defaultContext: NotificationContextType = {
  permissionStatus: "undetermined",
  hasPromptBeenShown: false,
  isPermissionLoading: true,
  expoPushToken: null,
  isTokenLoading: true,
  isRegistered: false,
  isRegistering: false,
  requestPermission: async () => false,
  markPromptAsShown: async () => {},
  registerForPushNotifications: async () => null,
  markAsRegisteredWithNovu: () => {},
  clearNotificationState: async () => {},
};

/**
 * Safe hook that returns default values when outside provider
 */
export function useNotificationContextSafe() {
  const context = useContext(NotificationContext);
  return context ?? defaultContext;
}
