import { LogBox } from "react-native";

// Suppress warnings from third-party dependencies and simulator limitations
if (__DEV__) {
  LogBox.ignoreLogs([
    "SafeAreaView has been deprecated",
    "EXTaskService: Cannot restore task",
    "Background tasks are not supported on iOS simulators",
  ]);
}

// Sentry first, so errors from the headless tasks below are reported.
import "./lib/sentry-init";
// Defines the Android lock-screen counter task in every JS context, including headless starts.
import "./lib/live-activity/android-task";
// Defines the background sync and location tasks at startup: a background launch mounts no components.
import "./lib/database/background-sync";
import "./lib/location/background-location";
import "expo-router/entry";
