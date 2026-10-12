import type { LiveActivityAttributes, LiveActivityState } from "@prostcounter/shared/schemas";
import { liveActivityStaleDate } from "@prostcounter/shared/utils";
import { requireOptionalNativeModule } from "expo";

import type { LiveActivityApi, PendingTap, PushTokenInfo } from "./types";

interface NativeLiveActivity {
  isSupported(): Promise<boolean>;
  start(attributesJson: string, stateJson: string, staleDate: string): Promise<void>;
  update(stateJson: string, staleDate: string): Promise<void>;
  end(): Promise<void>;
  getRunningAttributes(): Promise<string | null>;
  getRunningState(): Promise<string | null>;
  peekPendingTaps(): Promise<string>;
  removePendingTaps(consumptionIds: string[]): Promise<void>;
  addListener(event: "onPushToken", listener: (info: PushTokenInfo) => void): { remove(): void };
}

const native = requireOptionalNativeModule<NativeLiveActivity>("LiveActivity");

export const iosLiveActivity: LiveActivityApi = {
  async isSupported() {
    return native ? native.isSupported() : false;
  },
  async start(attributes, state) {
    await native?.start(
      JSON.stringify(attributes),
      JSON.stringify(state),
      liveActivityStaleDate(state, attributes),
    );
  },
  async update(state) {
    // The stale date needs the activity's own day; nothing to update without one.
    const attributes = await iosLiveActivity.getRunningAttributes();
    if (!attributes) {
      return;
    }
    await native?.update(JSON.stringify(state), liveActivityStaleDate(state, attributes));
  },
  async end() {
    await native?.end();
  },
  async getRunningAttributes() {
    const raw = native ? await native.getRunningAttributes() : null;
    return raw ? (JSON.parse(raw) as LiveActivityAttributes) : null;
  },
  async getRunningState() {
    const raw = native ? await native.getRunningState() : null;
    return raw ? (JSON.parse(raw) as LiveActivityState) : null;
  },
  addPushTokenListener(listener) {
    return native ? native.addListener("onPushToken", listener) : { remove: () => {} };
  },
  async peekPendingTaps() {
    const raw = native ? await native.peekPendingTaps() : "[]";
    return JSON.parse(raw) as PendingTap[];
  },
  async removePendingTaps(consumptionIds) {
    await native?.removePendingTaps(consumptionIds);
  },
  // iOS goes stale on its own (staleDate) and is removed at the system's 8 h cap.
  async endIfStale() {},
};
