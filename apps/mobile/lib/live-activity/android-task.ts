import type { LiveActivityState } from "@prostcounter/shared/schemas";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { generateUUID } from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { LiveActivity } from "@/modules/live-activity";
import {
  appendPendingTap,
  LOG_DRINK_ACTION,
  readAndroidSurface,
  renderAndroidSurface,
} from "@/modules/live-activity/src/android";

import { type AndroidTapDeps, applyServerState, handleAndroidTap } from "./android-tap";
import { logPendingTap } from "./log-tap";

export const LIVE_ACTIVITY_TASK = "PROSTCOUNTER_LIVE_ACTIVITY";

const deps: AndroidTapDeps = {
  surface: {
    read: readAndroidSurface,
    render: renderAndroidSurface,
    end: () => LiveActivity.end(),
    appendPending: appendPendingTap,
    peekPending: () => LiveActivity.peekPendingTaps(),
    removePending: (ids) => LiveActivity.removePendingTaps(ids),
  },
  logDrink: logPendingTap,
  currentUserId: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  },
  now: () => new Date(),
  newId: generateUUID,
};

type LiveActivityPush = {
  type?: string;
  state?: LiveActivityState | null;
  timestamp?: number;
  userId?: string;
};

function parsePush(data: unknown): LiveActivityPush | null {
  const inner = (data as { data?: { dataString?: string } } | null)?.data;
  if (!inner?.dataString) {
    return null;
  }
  try {
    return JSON.parse(inner.dataString) as LiveActivityPush;
  } catch {
    return null;
  }
}

if (Platform.OS === "android" && !TaskManager.isTaskDefined(LIVE_ACTIVITY_TASK)) {
  TaskManager.defineTask(LIVE_ACTIVITY_TASK, async ({ data, error }) => {
    if (error) {
      logger.error("[LiveActivity] task error", error);
      return;
    }
    try {
      if (data && typeof data === "object" && "actionIdentifier" in data) {
        if ((data as { actionIdentifier: string }).actionIdentifier === LOG_DRINK_ACTION) {
          await handleAndroidTap(deps);
        }
        return;
      }
      const push = parsePush(data);
      if (push?.type === "live-activity") {
        const timestamp = typeof push.timestamp === "number" ? push.timestamp : undefined;
        await applyServerState(deps, push.state ?? null, timestamp, push.userId);
      }
    } catch (taskError) {
      logger.error("[LiveActivity] task failed", taskError);
    }
  });
}

export async function registerLiveActivityTask(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.registerTaskAsync(LIVE_ACTIVITY_TASK);
}
