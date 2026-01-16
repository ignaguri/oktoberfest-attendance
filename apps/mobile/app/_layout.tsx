import "../global.css";

import { ErrorBoundary } from "@/components/error-boundary";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { GluestackUIProvider } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { useFocusManager } from "@/lib/data/focus-manager-setup";
import { useOnlineManager } from "@/lib/data/online-manager-setup";
import { DataProvider } from "@/lib/data/query-client";
import { mobileFestivalStorage } from "@/lib/festival-storage";
import { initMobileI18n } from "@/lib/i18n";
import { defaultScreenOptions } from "@/lib/navigation/header-config";
import {
  configureNotificationHandler,
  setupNotificationListeners,
  checkInitialNotification,
} from "@/lib/notifications/handlers";
import {
  NotificationProvider,
  useNotificationContext,
} from "@/lib/notifications/NotificationContext";
import { NovuProviderWrapper } from "@/lib/notifications/NovuProvider";
import { FestivalProvider } from "@prostcounter/shared/contexts";
import { ApiClientProvider } from "@prostcounter/shared/data";
import { I18nextProvider } from "@prostcounter/shared/i18n";
import { i18n } from "@prostcounter/shared/i18n";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
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
        console.error("Failed to initialize app:", error);
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
                {/* GluestackUIProvider must be inside ApiClientProvider
                    because its OverlayProvider renders modals/sheets
                    via portal at this level */}
                <GluestackUIProvider mode="light">
                  <AuthProvider>
                    <NotificationProvider>
                      <NovuProviderWrapper>
                        <FestivalProvider storage={mobileFestivalStorage}>
                          <NavigationGuard>
                            <NotificationPromptHandler />
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
                        </FestivalProvider>
                      </NovuProviderWrapper>
                    </NotificationProvider>
                  </AuthProvider>
                </GluestackUIProvider>
              </ApiClientProvider>
            </DataProvider>
          </ErrorBoundary>
          <StatusBar style="dark" />
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
