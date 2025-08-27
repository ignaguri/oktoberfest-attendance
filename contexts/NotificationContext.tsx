"use client";

import {
  syncUserWithNovu,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  registerFCMToken,
} from "@/lib/actions/notifications";
import { getFCMToken, onMessageListener } from "@/lib/firebase";
import { getUser } from "@/lib/sharedActions";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { Tables } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";

type NotificationPreferences = Tables<"user_notification_preferences">;

interface NotificationContextType {
  // User
  user: User | null;

  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (
    updates: Partial<
      Pick<
        NotificationPreferences,
        "group_join_enabled" | "checkin_enabled" | "push_enabled"
      >
    >,
  ) => Promise<void>;

  // Push notifications
  pushSupported: boolean;
  pushPermission: NotificationPermission | null;
  requestPushPermission: () => Promise<boolean>;

  // FCM token management
  fcmToken: string | null;
  registerFCMTokenWithNovu: () => Promise<boolean>;

  // Loading states
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [userSynced, setUserSynced] = useState<string | null>(null); // Track synced user ID

  const supabase = createSupabaseBrowserClient();

  // Get current user
  useEffect(() => {
    async function getCurrentUser() {
      try {
        const user = await getUser();
        setUser(user);
      } catch (error) {
        console.error("Failed to get user:", error);
        setUser(null);
      }
    }
    getCurrentUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Reset sync state when user changes
      if (!session?.user) {
        setUserSynced(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Check push notification support and permission, get FCM token
  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported =
        "Notification" in window && "serviceWorker" in navigator;
      setPushSupported(supported);

      if (supported) {
        setPushPermission(Notification.permission);

        // Get FCM token if permission is granted
        if (Notification.permission === "granted") {
          getFCMTokenAndStore();
        }
      }
    }
  }, []);

  const getFCMTokenAndStore = async () => {
    try {
      const token = await getFCMToken();
      setFcmToken(token);
      return token;
    } catch (error) {
      console.error("Failed to get FCM token:", error);
      return null;
    }
  };

  // Sync user with Novu and load preferences
  useEffect(() => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    async function syncUserAndLoadPreferences() {
      try {
        // Only sync with Novu if not already synced for this user
        if (user?.id && userSynced !== user.id) {
          const syncResult = await syncUserWithNovu();
          if (syncResult.success) {
            setUserSynced(user.id); // Mark user as synced
          }
        }
      } catch (error) {
        // Silent error handling
      }

      // Load notification preferences
      try {
        const preferences = await getUserNotificationPreferences();
        setPreferences(preferences);
      } catch (error) {
        // Silent error handling
      } finally {
        setLoading(false);
      }
    }

    syncUserAndLoadPreferences();
  }, [user, userSynced]);

  const registerFCMTokenWithNovu = useCallback(async (): Promise<boolean> => {
    if (!fcmToken) {
      return false;
    }

    try {
      const result = await registerFCMToken(fcmToken);
      return result.success;
    } catch (error) {
      return false;
    }
  }, [fcmToken]);

  // Register FCM token when user and token are both available
  useEffect(() => {
    if (!user || !user.id || !fcmToken) {
      return;
    }

    // Auto-register FCM token with Novu if push notifications are enabled
    if (preferences?.push_enabled) {
      registerFCMTokenWithNovu();
    }
  }, [user, fcmToken, preferences?.push_enabled, registerFCMTokenWithNovu]);

  // Listen for foreground messages
  useEffect(() => {
    if (!pushSupported || pushPermission !== "granted") {
      return;
    }

    onMessageListener()
      .then((payload) => {
        // Show notification manually since it's in foreground
        if (payload.notification) {
          new Notification(payload.notification.title || "ProstCounter", {
            body: payload.notification.body || "New notification",
            icon: "/android-chrome-192x192.png",
            tag: "prostcounter-foreground",
          });
        }
      })
      .catch(() => {
        // Silent error handling
      });
  }, [pushSupported, pushPermission]);

  const updatePreferences = async (
    updates: Partial<
      Pick<
        NotificationPreferences,
        "group_join_enabled" | "checkin_enabled" | "push_enabled"
      >
    >,
  ) => {
    if (!user || !user.id) {
      return;
    }

    try {
      const updatedPreferences =
        await updateUserNotificationPreferences(updates);
      setPreferences(updatedPreferences);
    } catch (error) {
      throw error;
    }
  };

  const requestPushPermission = async (): Promise<boolean> => {
    if (!pushSupported) {
      throw new Error("Push notifications not supported");
    }

    if (pushPermission === "granted") {
      // If already granted, just ensure we have the token registered
      if (fcmToken) {
        await registerFCMTokenWithNovu();
      }
      return true;
    }

    if (pushPermission === "denied") {
      throw new Error("Push notifications blocked");
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted") {
        // Get FCM token
        const token = await getFCMTokenAndStore();

        if (token) {
          // Register token with Novu
          await registerFCMToken(token);
        }

        // Enable push notifications in preferences
        await updatePreferences({ push_enabled: true });
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  };

  const value: NotificationContextType = {
    user,
    preferences,
    updatePreferences,
    pushSupported,
    pushPermission,
    requestPushPermission,
    fcmToken,
    registerFCMTokenWithNovu,
    loading,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}
