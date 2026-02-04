import "../global.css";

import { FestivalProvider, useFestival } from "@prostcounter/shared/contexts";
import { ApiClientProvider } from "@prostcounter/shared/data";
import { I18nextProvider } from "@prostcounter/shared/i18n";
import { i18n } from "@prostcounter/shared/i18n";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/error-boundary";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { SyncStatusBar } from "@/components/sync";
import { TutorialOverlay } from "@/components/tutorial";
import { GluestackUIProvider } from "@/components/ui";
import { UpdateAvailablePrompt } from "@/components/update/UpdateAvailablePrompt";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { GlobalAlertProvider } from "@/lib/alerts";
import { apiClient } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { useFocusManager } from "@/lib/data/focus-manager-setup";
import { useOnlineManager } from "@/lib/data/online-manager-setup";
import { DataProvider } from "@/lib/data/query-client";
import {
  registerBackgroundSync,
  setBackgroundSyncContext,
  unregisterBackgroundSync,
} from "@/lib/database/background-sync";
import { OfflineDataProvider } from "@/lib/database/offline-provider";
import { mobileFestivalStorage } from "@/lib/festival-storage";
import { initMobileI18n } from "@/lib/i18n";
import { LocationProvider } from "@/lib/location";
import { logger } from "@/lib/logger";
import { defaultScreenOptions } from "@/lib/navigation/header-config";
import {
  checkInitialNotification,
  configureNotificationHandler,
  setupNotificationListeners,
} from "@/lib/notifications/handlers";
import {
  NotificationProvider,
  useNotificationContext,
} from "@/lib/notifications/NotificationContext";
import { NovuProviderWrapper } from "@/lib/notifications/NovuProvider";
import { initSentry } from "@/lib/sentry";
import { TutorialProvider } from "@/lib/tutorial";

// Initialize Sentry for error monitoring (native only)
if (Platform.OS !== "web") {
  initSentry();
}

// Prevent splash screen from auto-hiding (only on native)
if (Platform.OS !== "web") {
  const SplashScreen = require("expo-splash-screen");
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore errors - splash screen may not be available
  });
}

// Configure notification handler at module level (before app renders)
if (Platform.OS !== "web") {
  configureNotificationHandler();
}

// Navigation guard component
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      // @ts-ignore - Root route "/" works at runtime but isn't in typed routes with NativeTabs
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

// Bridge component to connect OfflineDataProvider with Auth and Festival contexts
function OfflineDataBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentFestival } = useFestival();

  return (
    <OfflineDataProvider festivalId={currentFestival?.id} userId={user?.id}>
      {children}
    </OfflineDataProvider>
  );
}

// Background sync handler - registers/unregisters background sync based on auth state
function BackgroundSyncHandler() {
  const { user, isAuthenticated } = useAuth();
  const { currentFestival } = useFestival();

  useEffect(() => {
    if (Platform.OS === "web") return;

    async function setupBackgroundSync() {
      if (isAuthenticated && user?.id && currentFestival?.id) {
        // Set context for background sync task
        await setBackgroundSyncContext(user.id, currentFestival.id);
        // Register background sync (15 minute interval)
        const registered = await registerBackgroundSync(15 * 60);
        if (registered) {
          logger.info("[BackgroundSync] Registered successfully");
        }
      } else if (!isAuthenticated) {
        // Unregister when user logs out
        await setBackgroundSyncContext(null, null);
        await unregisterBackgroundSync();
      }
    }

    setupBackgroundSync();
  }, [isAuthenticated, user?.id, currentFestival?.id]);

  return null;
}

// Auto-show notification permission prompt after first login
function NotificationPromptHandler() {
  const { isAuthenticated } = useAuth();
  const {
    hasPromptBeenShown,
    permissionStatus,
    isPermissionLoading,
    requestPermission,
    markPromptAsShown,
    registerForPushNotifications,
  } = useNotificationContext();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Show prompt if user is authenticated, hasn't seen prompt, and permission is undetermined
    if (
      isAuthenticated &&
      !hasPromptBeenShown &&
      !isPermissionLoading &&
      permissionStatus === "undetermined" &&
      Platform.OS !== "web"
    ) {
      // Small delay to let the app settle after login
      const timer = setTimeout(() => setShowPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    hasPromptBeenShown,
    isPermissionLoading,
    permissionStatus,
  ]);

  const handleEnable = async () => {
    setShowPrompt(false);
    const granted = await requestPermission();
    if (granted) {
      await registerForPushNotifications();
    }
  };

  const handleSkip = () => {
    setShowPrompt(false);
    markPromptAsShown();
  };

  return (
    <NotificationPermissionPrompt
      isOpen={showPrompt}
      onClose={() => setShowPrompt(false)}
      onEnable={handleEnable}
      onSkip={handleSkip}
    />
  );
}

// Show update prompt when an OTA update has been downloaded
function UpdatePromptHandler() {
  const { isUpdateReady, applyUpdate } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const showPrompt = isUpdateReady && !dismissed;

  const handleUpdate = async () => {
    setIsRestarting(true);
    await applyUpdate();
  };

  return (
    <UpdateAvailablePrompt
      isOpen={showPrompt}
      onClose={() => setDismissed(true)}
      onUpdate={handleUpdate}
      isLoading={isRestarting}
    />
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  // Setup React Query integrations with React Native
  useFocusManager(); // Enable refetchOnWindowFocus when app returns from background
  useOnlineManager(); // Pause queries when offline, resume when online

  useEffect(() => {
    async function prepare() {
      try {
        await initMobileI18n();
      } catch (error) {
        logger.error("Failed to initialize app", { error });
      } finally {
        setIsReady(true);
        if (Platform.OS !== "web") {
          const SplashScreen = require("expo-splash-screen");
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    prepare();
  }, []);

  // Setup notification listeners
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Setup listeners for notification interactions
    const cleanup = setupNotificationListeners();

    // Check if app was opened from a notification (cold start)
    checkInitialNotification();

    return cleanup;
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ErrorBoundary>
            <DataProvider>
              <ApiClientProvider client={apiClient}>
                <AuthProvider>
                  <FestivalProvider storage={mobileFestivalStorage}>
                    <TutorialProvider>
                      {/* OfflineDataBridge must wrap GluestackUIProvider so that
                          portal-rendered content (Actionsheets, Modals) have access
                          to the OfflineDataProvider context */}
                      <OfflineDataBridge>
                        <GluestackUIProvider mode="light">
                          <GlobalAlertProvider>
                            <NotificationProvider>
                              <NovuProviderWrapper>
                                <LocationProvider>
                                  <NavigationGuard>
                                    <BackgroundSyncHandler />
                                    <NotificationPromptHandler />
                                    <UpdatePromptHandler />
                                    <TutorialOverlay />
                                    <SyncStatusBar />
                                    <Stack
                                      screenOptions={{
                                        headerShown: false,
                                        animation: "slide_from_right",
                                        ...defaultScreenOptions,
                                      }}
                                    >
                                      <Stack.Screen name="(auth)" />
                                      <Stack.Screen name="(tabs)" />
                                      <Stack.Screen
                                        name="settings"
                                        options={{
                                          headerShown: false,
                                          presentation: "card",
                                        }}
                                      />
                                      <Stack.Screen
                                        name="groups"
                                        options={{
                                          headerShown: false,
                                          presentation: "card",
                                        }}
                                      />
                                      <Stack.Screen
                                        name="achievements"
                                        options={{
                                          headerShown: false,
                                          presentation: "card",
                                        }}
                                      />
                                      <Stack.Screen
                                        name="join-group/[token]"
                                        options={{
                                          headerShown: false,
                                          presentation: "fullScreenModal",
                                        }}
                                      />
                                      <Stack.Screen name="+not-found" />
                                    </Stack>
                                  </NavigationGuard>
                                </LocationProvider>
                              </NovuProviderWrapper>
                            </NotificationProvider>
                          </GlobalAlertProvider>
                        </GluestackUIProvider>
                      </OfflineDataBridge>
                    </TutorialProvider>
                  </FestivalProvider>
                </AuthProvider>
              </ApiClientProvider>
            </DataProvider>
          </ErrorBoundary>
          <StatusBar style="dark" />
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
