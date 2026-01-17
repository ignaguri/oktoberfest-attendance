"use client";

import type { Tables } from "@prostcounter/db";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiClient } from "@/lib/api-client";
import { getFCMToken, onMessageListener } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type NotificationPreferences = Tables<"user_notification_preferences">;

// API response type (camelCase)
type ApiPreferences = {
  userId: string;
  pushEnabled: boolean | null;
  groupJoinEnabled: boolean | null;
  checkinEnabled: boolean | null;
  remindersEnabled: boolean | null;
  achievementNotificationsEnabled: boolean | null;
  groupNotificationsEnabled: boolean | null;
  createdAt: string;
  updatedAt: string | null;
};

// Convert API response to DB type
const mapApiToDbPreferences = (
  api: ApiPreferences,
): NotificationPreferences => ({
  id: "", // DB type requires id but API doesn't return it - use empty string as placeholder
  user_id: api.userId,
  push_enabled: api.pushEnabled,
  group_join_enabled: api.groupJoinEnabled,
  checkin_enabled: api.checkinEnabled,
  reminders_enabled: api.remindersEnabled,
  achievement_notifications_enabled: api.achievementNotificationsEnabled,
  group_notifications_enabled: api.groupNotificationsEnabled,
  created_at: api.createdAt,
  updated_at: api.updatedAt,
});

interface NotificationContextType {
  // User
  user: User | null;

  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (
    updates: Partial<
      Pick<
        NotificationPreferences,
        | "reminders_enabled"
        | "group_notifications_enabled"
        | "achievement_notifications_enabled"
        | "push_enabled"
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
  isWhatsNewVisible: boolean;
  isInstallPWAVisible: boolean;
  setWhatsNewVisible: (visible: boolean) => void;
  setInstallPWAVisible: (visible: boolean) => void;
  canShowInstallPWA: boolean;
  canShowWhatsNew: boolean;
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

  // New coordination state for WhatsNew and InstallPWA
  const [isWhatsNewVisible, setIsWhatsNewVisible] = useState(false);
  const [isInstallPWAVisible, setIsInstallPWAVisible] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // Coordination logic: only one can be visible at a time
  const canShowInstallPWA = !isWhatsNewVisible;
  const canShowWhatsNew = !isInstallPWAVisible;

  const setWhatsNewVisible = (visible: boolean) => {
    setIsWhatsNewVisible(visible);
    // If WhatsNew becomes visible, ensure InstallPWA is hidden
    if (visible) {
      setIsInstallPWAVisible(false);
    }
  };

  const setInstallPWAVisible = (visible: boolean) => {
    setIsInstallPWAVisible(visible);
    // If InstallPWA becomes visible, ensure WhatsNew is hidden
    if (visible) {
      setIsWhatsNewVisible(false);
    }
  };

  // Additional coordination: auto-hide InstallPWA after a delay if WhatsNew is shown
  useEffect(() => {
    if (isWhatsNewVisible && isInstallPWAVisible) {
      const timer = setTimeout(() => {
        setIsInstallPWAVisible(false);
      }, 300); // Small delay for smooth transition

      return () => clearTimeout(timer);
    }
  }, [isWhatsNewVisible, isInstallPWAVisible]);

  // Get current user
  useEffect(() => {
    async function getCurrentUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        logger.error(
          "Failed to get current user in NotificationContext",
          logger.clientComponent("NotificationContext"),
          error as Error,
        );
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
      logger.error(
        "Failed to get FCM token",
        logger.clientComponent("NotificationContext"),
        error as Error,
      );
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
          const syncResult = await apiClient.notifications.subscribe({
            email: user.email || undefined,
          });
          if (syncResult.success) {
            setUserSynced(user.id); // Mark user as synced
          }
        }
      } catch (error) {
        // Silent error handling
      }

      // Load notification preferences
      try {
        const apiPreferences = await apiClient.notifications.getPreferences();
        if (apiPreferences) {
          setPreferences(mapApiToDbPreferences(apiPreferences));
        } else {
          setPreferences(null);
        }
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
      const result = await apiClient.notifications.registerToken(fcmToken);
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
        | "reminders_enabled"
        | "group_notifications_enabled"
        | "achievement_notifications_enabled"
        | "push_enabled"
      >
    >,
  ) => {
    if (!user || !user.id) {
      return;
    }

    try {
      // Map snake_case to camelCase for API
      const apiUpdates: {
        pushEnabled?: boolean;
        remindersEnabled?: boolean;
        groupNotificationsEnabled?: boolean;
        achievementNotificationsEnabled?: boolean;
      } = {};

      if (updates.push_enabled !== undefined && updates.push_enabled !== null) {
        apiUpdates.pushEnabled = updates.push_enabled;
      }
      if (
        updates.reminders_enabled !== undefined &&
        updates.reminders_enabled !== null
      ) {
        apiUpdates.remindersEnabled = updates.reminders_enabled;
      }
      if (
        updates.group_notifications_enabled !== undefined &&
        updates.group_notifications_enabled !== null
      ) {
        apiUpdates.groupNotificationsEnabled =
          updates.group_notifications_enabled;
      }
      if (
        updates.achievement_notifications_enabled !== undefined &&
        updates.achievement_notifications_enabled !== null
      ) {
        apiUpdates.achievementNotificationsEnabled =
          updates.achievement_notifications_enabled;
      }

      await apiClient.notifications.updatePreferences(apiUpdates);

      // Reload preferences after update
      const apiPreferences = await apiClient.notifications.getPreferences();
      if (apiPreferences) {
        setPreferences(mapApiToDbPreferences(apiPreferences));
      }
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
          // Register token with Novu via API
          await apiClient.notifications.registerToken(token);
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
    isWhatsNewVisible,
    isInstallPWAVisible,
    setWhatsNewVisible,
    setInstallPWAVisible,
    canShowInstallPWA,
    canShowWhatsNew,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Default context value for use outside NotificationProvider (e.g., on public pages)
const defaultContextValue: NotificationContextType = {
  user: null,
  preferences: null,
  updatePreferences: async () => {},
  pushSupported: false,
  pushPermission: null,
  requestPushPermission: async () => false,
  fcmToken: null,
  registerFCMTokenWithNovu: async () => false,
  loading: false,
  isWhatsNewVisible: false,
  isInstallPWAVisible: false,
  setWhatsNewVisible: () => {},
  setInstallPWAVisible: () => {},
  canShowInstallPWA: false,
  canShowWhatsNew: false,
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  // Return safe default when used outside NotificationProvider (e.g., on public pages)
  if (context === undefined) {
    return defaultContextValue;
  }
  return context;
}
