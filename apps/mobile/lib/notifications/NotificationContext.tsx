import {
  hasNotificationPromptBeenShown,
  setNotificationPromptShown,
  getNotificationPermissionStatus,
  setNotificationPermissionStatus,
  getStoredFCMToken,
  storeFCMToken as saveFCMToken,
  clearFCMToken,
  type NotificationPermissionStatus,
} from "@/lib/auth/secure-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";

/**
 * Notification Context Type
 */
interface NotificationContextType {
  // Permission state
  permissionStatus: NotificationPermissionStatus;
  hasPromptBeenShown: boolean;
  isPermissionLoading: boolean;

  // FCM state
  fcmToken: string | null;
  isFCMTokenLoading: boolean;

  // Registration state
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
  }) => Promise<boolean>;
  clearNotificationState: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

/**
 * Notification Provider
 *
 * Manages notification permissions, FCM tokens, and Novu registration.
 * Note: expo-notifications and @react-native-firebase/messaging must be installed
 * for full functionality. This context provides a safe wrapper that handles
 * cases where the packages aren't available.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Permission state
  const [permissionStatus, setPermissionStatusState] =
    useState<NotificationPermissionStatus>("undetermined");
  const [hasPromptBeenShown, setHasPromptBeenShown] = useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  // FCM state
  const [fcmToken, setFCMToken] = useState<string | null>(null);
  const [isFCMTokenLoading, setIsFCMTokenLoading] = useState(true);

  // Registration state
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  /**
   * Load initial notification state from storage and sync with device permission
   */
  useEffect(() => {
    async function loadNotificationState() {
      try {
        const [promptShown, storedStatus, storedToken] = await Promise.all([
          hasNotificationPromptBeenShown(),
          getNotificationPermissionStatus(),
          getStoredFCMToken(),
        ]);

        setHasPromptBeenShown(promptShown);
        if (storedToken) {
          setFCMToken(storedToken);
          setIsRegistered(true);
        }

        // Check actual device permission status and sync with stored state
        try {
          const Notifications = await import("expo-notifications");
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
            console.log(
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
            console.log(
              "Permission granted but no token, attempting to get FCM token...",
            );
            try {
              // Try to get FCM token from Firebase Messaging
              const messaging =
                await import("@react-native-firebase/messaging");
              const token = await messaging.default().getToken();
              if (token) {
                await saveFCMToken(token);
                setFCMToken(token);
                setIsRegistered(true);
                console.log("Successfully obtained and stored FCM token");
              }
            } catch (tokenError) {
              // This is expected to fail in simulator or if Firebase is not configured
              console.error(
                "Could not get FCM token (expected in simulator):",
                tokenError,
              );
            }
          }
        } catch {
          // expo-notifications not available, use stored status
          if (storedStatus) {
            setPermissionStatusState(storedStatus);
          }
        }
      } catch (error) {
        console.error("Error loading notification state:", error);
      } finally {
        setIsPermissionLoading(false);
        setIsFCMTokenLoading(false);
      }
    }

    loadNotificationState();
  }, []);

  /**
   * Mark the permission prompt as shown
   */
  const markPromptAsShown = useCallback(async () => {
    await setNotificationPromptShown(true);
    setHasPromptBeenShown(true);
  }, []);

  /**
   * Request notification permission
   *
   * Note: This is a placeholder implementation.
   * Full implementation requires expo-notifications to be installed.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Mark prompt as shown first
      await markPromptAsShown();

      // Try to dynamically import expo-notifications
      let Notifications: any = null;
      try {
        Notifications = await import("expo-notifications");
      } catch {
        console.warn(
          "expo-notifications not available. Notification permissions cannot be requested.",
        );
        setPermissionStatusState("denied");
        await setNotificationPermissionStatus("denied");
        return false;
      }

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
      console.error("Error requesting notification permission:", error);
      setPermissionStatusState("denied");
      await setNotificationPermissionStatus("denied");
      return false;
    }
  }, [markPromptAsShown]);

  /**
   * Register for push notifications
   *
   * Gets the FCM registration token using Firebase Messaging.
   * This token is required for Novu's FCM provider to send push notifications.
   */
  const registerForPushNotifications = useCallback(
    async (_userProfile?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    }): Promise<boolean> => {
      if (permissionStatus !== "granted") {
        console.warn(
          "Cannot register for push notifications without permission",
        );
        return false;
      }

      setIsRegistering(true);

      try {
        // Use Firebase Messaging to get FCM token
        const messaging = await import("@react-native-firebase/messaging");

        // Get the FCM registration token
        const token = await messaging.default().getToken();

        if (!token) {
          console.error("Failed to get FCM registration token");
          return false;
        }

        console.log("FCM token obtained:", token.substring(0, 20) + "...");

        // Store token locally
        await saveFCMToken(token);
        setFCMToken(token);

        // Register token with backend via API client
        // Note: This requires the API client to be available
        // The actual registration will be handled by the parent component
        // that has access to the API client

        setIsRegistered(true);
        return true;
      } catch (error) {
        console.error("Error registering for push notifications:", error);
        // Fallback to expo-notifications if Firebase Messaging is not available
        try {
          console.log("Falling back to expo-notifications...");
          const Notifications = await import("expo-notifications");
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const token = tokenData.data;

          if (token) {
            console.log(
              "Expo push token obtained:",
              token.substring(0, 20) + "...",
            );
            await saveFCMToken(token);
            setFCMToken(token);
            setIsRegistered(true);
            return true;
          }
        } catch (fallbackError) {
          console.error(
            "Fallback to expo-notifications also failed:",
            fallbackError,
          );
        }
        return false;
      } finally {
        setIsRegistering(false);
      }
    },
    [permissionStatus],
  );

  /**
   * Clear all notification state
   */
  const clearNotificationState = useCallback(async () => {
    await clearFCMToken();
    setFCMToken(null);
    setIsRegistered(false);
  }, []);

  const value: NotificationContextType = {
    // Permission state
    permissionStatus,
    hasPromptBeenShown,
    isPermissionLoading,

    // FCM state
    fcmToken,
    isFCMTokenLoading,

    // Registration state
    isRegistered,
    isRegistering,

    // Actions
    requestPermission,
    markPromptAsShown,
    registerForPushNotifications,
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
  fcmToken: null,
  isFCMTokenLoading: true,
  isRegistered: false,
  isRegistering: false,
  requestPermission: async () => false,
  markPromptAsShown: async () => {},
  registerForPushNotifications: async () => false,
  clearNotificationState: async () => {},
};

/**
 * Safe hook that returns default values when outside provider
 */
export function useNotificationContextSafe() {
  const context = useContext(NotificationContext);
  return context ?? defaultContext;
}
