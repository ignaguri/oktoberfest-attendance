import type {
  DrinkType,
  LiveActivityAttributes,
  LiveActivityMessage,
  LiveActivityState,
} from "@prostcounter/shared/schemas";

export interface PendingTap {
  /** Who tapped; replay drops other users' taps. Missing only on pre-release builds. */
  userId?: string;
  consumptionId: string;
  festivalId: string;
  date: string;
  drinkType: DrinkType;
  tentId: string | null;
  tappedAt: string;
}

export interface PushTokenInfo {
  token: string;
  apnsEnvironment: "sandbox" | "production" | null;
}

/** Android renders text itself; `{{count}}` and `{{time}}` are replaced at render time. */
export interface AndroidLabels {
  title: string;
  paused: string;
  noTent: string;
  lastDrink: string;
  channelName: string;
  messages: Record<LiveActivityMessage, string>;
}

export interface LiveActivityApi {
  isSupported(): Promise<boolean>;
  /** `userId` owns Android's offline taps when the headless task has no session. */
  start(
    attributes: LiveActivityAttributes,
    state: LiveActivityState,
    labels: AndroidLabels,
    userId: string,
  ): Promise<void>;
  update(state: LiveActivityState): Promise<void>;
  end(): Promise<void>;
  getRunningAttributes(): Promise<LiveActivityAttributes | null>;
  /** What the running surface shows now, lock-screen taps included. */
  getRunningState(): Promise<LiveActivityState | null>;
  addPushTokenListener(listener: (info: PushTokenInfo) => void): { remove(): void };
  peekPendingTaps(): Promise<PendingTap[]>;
  removePendingTaps(consumptionIds: string[]): Promise<void>;
  endIfStale(now: Date): Promise<void>;
}
