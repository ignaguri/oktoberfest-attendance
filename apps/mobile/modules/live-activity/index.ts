import { Platform } from "react-native";

import { androidLiveActivity } from "./src/android";
import { iosLiveActivity } from "./src/ios";
import type { LiveActivityApi } from "./src/types";

export type { AndroidLabels, LiveActivityApi, PendingTap, PushTokenInfo } from "./src/types";

export const LiveActivity: LiveActivityApi =
  Platform.OS === "ios" ? iosLiveActivity : androidLiveActivity;
