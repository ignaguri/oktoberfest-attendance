import { LogBox } from "react-native";

// Suppress warnings from third-party dependencies and simulator limitations
if (__DEV__) {
  LogBox.ignoreLogs([
    "SafeAreaView has been deprecated",
    "EXTaskService: Cannot restore task",
    "Background tasks are not supported on iOS simulators",
  ]);
}

import "expo-router/entry";
