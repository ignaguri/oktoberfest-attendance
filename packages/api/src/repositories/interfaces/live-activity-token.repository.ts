import type { RegisterLiveActivityTokenInput } from "@prostcounter/shared";

export interface LiveActivityTokenRecord {
  id: string;
  userId: string;
  platform: "ios" | "android";
  token: string;
  apnsEnvironment: "sandbox" | "production" | null;
  festivalId: string;
  date: string;
}

/** Push tokens of the caller's running lock-screen counters (live_activity_tokens). */
export interface LiveActivityTokenStore {
  upsert(userId: string, input: RegisterLiveActivityTokenInput): Promise<void>;
  deleteToken(userId: string, token: string): Promise<void>;
  listForUser(userId: string): Promise<LiveActivityTokenRecord[]>;
  deleteByIds(ids: string[]): Promise<void>;
}
