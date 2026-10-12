import { LogBox } from "react-native";

// Suppress warnings from third-party dependencies and simulator limitations
if (__DEV__) {
  LogBox.ignoreLogs([
    "SafeAreaView has been deprecated",
    "EXTaskService: Cannot restore task",
    "Background tasks are not supported on iOS simulators",
  ]);
}

// Defines the Android lock-screen counter task in every JS context, including headless starts.
import "./lib/live-activity/android-task";
import "expo-router/entry";
