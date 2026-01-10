import "../global.css";

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
import { GluestackUIProvider } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { DataProvider } from "@/lib/data/query-client";
import { FestivalProvider } from "@/lib/festival/FestivalContext";
import { initMobileI18n } from "@/lib/i18n";
import { defaultScreenOptions } from "@/lib/navigation/header-config";

// Prevent splash screen from auto-hiding (only on native)
if (Platform.OS !== "web") {
  const SplashScreen = require("expo-splash-screen");
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore errors - splash screen may not be available
  });
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

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

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

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="light">
          <I18nextProvider i18n={i18n}>
            <ErrorBoundary>
              <DataProvider>
                <ApiClientProvider client={apiClient}>
                  <AuthProvider>
                    <FestivalProvider>
                      <NavigationGuard>
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
                          <Stack.Screen name="+not-found" />
                        </Stack>
                      </NavigationGuard>
                    </FestivalProvider>
                  </AuthProvider>
                </ApiClientProvider>
              </DataProvider>
            </ErrorBoundary>
            <StatusBar style="dark" />
          </I18nextProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
