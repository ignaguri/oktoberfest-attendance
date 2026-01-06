import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  MD3LightTheme,
  PaperProvider,
  configureFonts,
} from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nextProvider } from "@prostcounter/shared/i18n";
import { i18n } from "@prostcounter/shared/i18n";

import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { DataProvider } from "@/lib/data/query-client";
import { FestivalProvider } from "@/lib/festival/FestivalContext";
import { initMobileI18n } from "@/lib/i18n";

// Prevent splash screen from auto-hiding (only on native)
if (Platform.OS !== "web") {
  const SplashScreen = require("expo-splash-screen");
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore errors - splash screen may not be available
  });
}

// ProstCounter theme (yellow-based)
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#F59E0B", // yellow-500
    primaryContainer: "#FEF3C7", // yellow-100
    secondary: "#D97706", // yellow-600
    secondaryContainer: "#FDE68A", // yellow-200
    surface: "#FFFFFF",
    surfaceVariant: "#FFFBEB", // yellow-50
    background: "#FFFFFF",
    error: "#EF4444",
    onPrimary: "#000000",
    onSecondary: "#000000",
    onSurface: "#1F2937",
    onBackground: "#1F2937",
    outline: "#D1D5DB",
  },
  fonts: configureFonts({ config: {} }),
};

// Navigation guard component
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated but in auth group
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
        // Initialize i18n
        await initMobileI18n();
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        setIsReady(true);
        // Hide splash screen (only on native)
        if (Platform.OS !== "web") {
          const SplashScreen = require("expo-splash-screen");
          SplashScreen.hideAsync().catch(() => {
            // Ignore errors
          });
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
      <I18nextProvider i18n={i18n}>
        <PaperProvider theme={theme}>
          <DataProvider>
            <AuthProvider>
              <FestivalProvider>
                <NavigationGuard>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "slide_from_right",
                    }}
                  >
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                </NavigationGuard>
              </FestivalProvider>
            </AuthProvider>
          </DataProvider>
          <StatusBar style="dark" />
        </PaperProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
