import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LiveActivityAttributes, LiveActivityState } from "@prostcounter/shared/schemas";
import {
  drinkBreakdown,
  drinkEmoji,
  formatLocalized,
  isLiveActivityStale,
} from "@prostcounter/shared/utils";
import * as Notifications from "expo-notifications";

import type { AndroidLabels, LiveActivityApi, PendingTap } from "./types";

export const LOG_DRINK_ACTION = "LOG_DRINK";
const NOTIFICATION_ID = "live-activity";
const CHANNEL_ID = "live-activity";
const CATEGORY_ID = "live-activity";
const SURFACE_KEY = "liveActivity.surface";
const PENDING_KEY = "liveActivity.pendingTaps";

export interface AndroidSurface {
  attributes: LiveActivityAttributes;
  state: LiveActivityState;
  labels: AndroidLabels;
  userId?: string;
  /** Server time (ms) of the newest data shown; older pushes are dropped. */
  appliedAt?: number;
}

export async function readAndroidSurface(): Promise<AndroidSurface | null> {
  const raw = await AsyncStorage.getItem(SURFACE_KEY);
  return raw ? (JSON.parse(raw) as AndroidSurface) : null;
}

async function post(surface: AndroidSurface): Promise<void> {
  const { state, labels } = surface;
  // The action label repeats the last drink, so refresh the category each render.
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: LOG_DRINK_ACTION,
      buttonTitle: `+1 ${drinkEmoji(state.lastDrinkType)}`,
      options: { opensAppToForeground: false },
    },
  ]);

  const stale = isLiveActivityStale(state, surface.attributes, new Date());
  let status: string | null = null;
  if (stale) {
    status = labels.paused;
  } else if (state.message) {
    status = labels.messages[state.message];
  }
  const where = `📍 ${state.tentName ?? labels.noTent}`;
  const lastActivity = labels.lastActivity.replace(
    "{{time}}",
    formatLocalized(new Date(state.lastLogAt), "p"),
  );
  const details = `${where} · ${lastActivity}`;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: labels.title.replace("{{count}}", drinkBreakdown(state)),
      subtitle: surface.attributes.festivalName,
      // Status first: it's the line that asks for action.
      body: status ? `${status}\n${details}` : details,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: CATEGORY_ID,
      data: { type: "live-activity" },
    },
    trigger: { channelId: CHANNEL_ID },
  });
}

export async function renderAndroidSurface(
  state: LiveActivityState,
  appliedAt?: number,
): Promise<void> {
  const surface = await readAndroidSurface();
  if (!surface) {
    return;
  }
  const next = { ...surface, state, appliedAt: appliedAt ?? surface.appliedAt };
  await AsyncStorage.setItem(SURFACE_KEY, JSON.stringify(next));
  await post(next);
}

async function readPending(): Promise<PendingTap[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? (JSON.parse(raw) as PendingTap[]) : [];
}

export async function appendPendingTap(tap: PendingTap): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...(await readPending()), tap]));
}

export const androidLiveActivity: LiveActivityApi = {
  async isSupported() {
    return true;
  },
  async start(attributes, state, labels, userId) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: labels.channelName,
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      showBadge: false,
    });
    const surface: AndroidSurface = { attributes, state, labels, userId };
    await AsyncStorage.setItem(SURFACE_KEY, JSON.stringify(surface));
    await post(surface);
  },
  async update(state) {
    await renderAndroidSurface(state);
  },
  async end() {
    await AsyncStorage.removeItem(SURFACE_KEY);
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  },
  async getRunningAttributes() {
    return (await readAndroidSurface())?.attributes ?? null;
  },
  async getRunningState() {
    return (await readAndroidSurface())?.state ?? null;
  },
  // Android registers the device's Expo push token instead (LiveActivityController).
  addPushTokenListener() {
    return { remove: () => {} };
  },
  async peekPendingTaps() {
    return readPending();
  },
  async removePendingTaps(consumptionIds) {
    const kept = (await readPending()).filter((tap) => !consumptionIds.includes(tap.consumptionId));
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(kept));
  },
  async endIfStale(now) {
    const surface = await readAndroidSurface();
    if (surface && isLiveActivityStale(surface.state, surface.attributes, now)) {
      await androidLiveActivity.end();
    }
  },
};
