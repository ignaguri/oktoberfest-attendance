/**
 * Android Branded Splash
 *
 * Android 12+ forces a system splash (small icon on a flat color) and ignores
 * full-screen splash images. This overlay renders the same poster iOS shows as
 * a full-screen in-app view, and holds it until auth has resolved.
 *
 * The native splash is hidden from here (once the poster has loaded) so the
 * user never sees a blank frame between the two.
 */

import { useEffect, useState } from "react";
import { Animated, Image, Platform, View } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";

const POSTER = require("../../assets/images/splash-screen.png");

const MIN_VISIBLE_MS = 600;
const FADE_MS = 250;

export function hideNativeSplash() {
  const SplashScreen = require("expo-splash-screen");
  SplashScreen.hideAsync().catch(() => {});
}

export function AndroidBrandedSplash() {
  const { isLoading } = useAuth();
  const [isPosterLoaded, setIsPosterLoaded] = useState(false);
  const [hasMinTimeElapsed, setHasMinTimeElapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!isPosterLoaded) {
      return;
    }
    hideNativeSplash();
    const minTimerId = setTimeout(() => setHasMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(minTimerId);
  }, [isPosterLoaded]);

  const canDismiss = isPosterLoaded && hasMinTimeElapsed && !isLoading;

  useEffect(() => {
    if (!canDismiss) {
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => setIsDismissed(true));
  }, [canDismiss, opacity]);

  if (Platform.OS !== "android" || isDismissed) {
    return null;
  }

  return (
    <View
      className="absolute inset-0"
      pointerEvents={canDismiss ? "none" : "auto"}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ flex: 1, opacity }}>
        <Image
          source={POSTER}
          alt=""
          resizeMode="cover"
          className="h-full w-full"
          onLoadEnd={() => setIsPosterLoaded(true)}
        />
      </Animated.View>
    </View>
  );
}
