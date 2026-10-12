import type { Database } from "@prostcounter/db";
import type { LiveActivityState } from "@prostcounter/shared";
import {
  type BuildLiveActivityStateInput,
  buildLiveActivityState,
  liveActivityStaleDate,
} from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger";
import type {
  FestivalRef,
  LiveActivityTokenRecord,
  LiveActivityTokenStore,
} from "../../repositories/interfaces";
import {
  SupabaseAttendanceRepository,
  SupabaseConsumptionRepository,
} from "../../repositories/supabase";
import { SupabaseLiveActivityTokenRepository } from "../../repositories/supabase/live-activity-token.repository";
import { festivalDateOf } from "../../utils/festival-dates";
import { ApnsClient, isDeadApnsToken, readApnsConfig } from "./apns-client";
import { type ExpoPushResult, sendExpoDataPush } from "./expo-push-client";

export interface LiveActivityPushDeps {
  tokens: LiveActivityTokenStore;
  loadFestival: (festivalId: string) => Promise<FestivalRef | null>;
  loadDay: (
    userId: string,
    festivalId: string,
    date: string,
  ) => Promise<BuildLiveActivityStateInput>;
  apns: Pick<ApnsClient, "sendLiveActivity"> | null;
  sendExpo: (token: string, data: Record<string, unknown>) => Promise<ExpoPushResult>;
  now: () => Date;
}

const toSeconds = (iso: string | Date) => Math.floor(new Date(iso).getTime() / 1000);

// ActivityKit needs a content state even on "end"; nothing renders it.
function endState(now: Date): LiveActivityState {
  return {
    drinkCount: 0,
    beerCount: 0,
    tentName: null,
    lastDrinkType: "beer",
    lastTentId: null,
    pendingCount: 0,
    lastLogAt: now.toISOString(),
    message: null,
  };
}

export class LiveActivityPushService {
  constructor(private deps: LiveActivityPushDeps) {}

  /** Pushes today's state to every surface the user has open; prunes stale and dead tokens. */
  async notifyUserChanged(userId: string): Promise<void> {
    const tokens = await this.deps.tokens.listForUser(userId);
    if (tokens.length === 0) {
      return;
    }

    const now = this.deps.now();
    const toDelete: string[] = [];
    const groups = new Map<string, LiveActivityTokenRecord[]>();
    for (const token of tokens) {
      const key = `${token.festivalId}|${token.date}`;
      groups.set(key, [...(groups.get(key) ?? []), token]);
    }

    for (const group of groups.values()) {
      const { festivalId, date } = group[0];
      try {
        const festival = await this.deps.loadFestival(festivalId);
        if (!festival || festivalDateOf(festival, now) !== date) {
          toDelete.push(...group.map((t) => t.id));
          continue;
        }

        // Taken before the read: a later read never sees less, so Android can drop older pushes.
        const builtAt = this.deps.now().getTime();
        const state = buildLiveActivityState(await this.deps.loadDay(userId, festivalId, date));
        for (const token of group) {
          try {
            const dead = await this.send(token, state, now, builtAt);
            if (dead) {
              toDelete.push(token.id);
            }
          } catch (error) {
            logger.error(
              {
                userId,
                tokenId: token.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Live activity push failed",
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            userId,
            festivalId,
            date,
            error: error instanceof Error ? error.message : String(error),
          },
          "Live activity group refresh failed",
        );
      }
    }

    if (toDelete.length > 0) {
      try {
        await this.deps.tokens.deleteByIds(toDelete);
      } catch (error) {
        logger.error(
          { userId, error: error instanceof Error ? error.message : String(error) },
          "Live activity token cleanup failed",
        );
      }
    }
  }

  /** True when the token is dead and should be deleted. */
  private async send(
    token: LiveActivityTokenRecord,
    state: LiveActivityState | null,
    now: Date,
    builtAt: number,
  ): Promise<boolean> {
    if (token.platform === "android") {
      const result = await this.deps.sendExpo(token.token, {
        type: "live-activity",
        state,
        timestamp: builtAt,
        userId: token.userId,
      });
      if (!result.ok && !result.deviceNotRegistered) {
        logger.error(
          { tokenId: token.id, platform: token.platform, error: result.error },
          "Live activity Expo push rejected",
        );
      }
      return result.deviceNotRegistered;
    }

    if (!this.deps.apns || !token.apnsEnvironment) {
      return false;
    }
    const aps = state
      ? {
          timestamp: Math.floor(builtAt / 1000),
          event: "update",
          "content-state": state,
          "stale-date": toSeconds(liveActivityStaleDate(state)),
        }
      : {
          timestamp: Math.floor(builtAt / 1000),
          event: "end",
          "content-state": endState(now),
          "dismissal-date": toSeconds(now),
        };
    const result = await this.deps.apns.sendLiveActivity({
      token: token.token,
      environment: token.apnsEnvironment,
      payload: { aps },
    });
    const dead = isDeadApnsToken(result);
    if (!dead && result.status !== 200) {
      logger.error(
        {
          tokenId: token.id,
          platform: token.platform,
          status: result.status,
          reason: result.reason,
        },
        "Live activity APNs push rejected",
      );
    }
    return dead;
  }
}

// One client per process: a client per refresh would sign a new provider token on every
// write, and APNs rejects refreshes faster than every 20 minutes.
let sharedApnsClient: ApnsClient | null | undefined;

function getApnsClient(): ApnsClient | null {
  if (sharedApnsClient === undefined) {
    const config = readApnsConfig();
    sharedApnsClient = config ? new ApnsClient(config) : null;
  }
  return sharedApnsClient;
}

export function createLiveActivityPushService(supabase: SupabaseClient): LiveActivityPushService {
  const client = supabase as SupabaseClient<Database>;
  const attendanceRepo = new SupabaseAttendanceRepository(client);
  const consumptionRepo = new SupabaseConsumptionRepository(client);

  return new LiveActivityPushService({
    tokens: new SupabaseLiveActivityTokenRepository(client),
    loadFestival: (festivalId) => attendanceRepo.festivalExists(festivalId),
    loadDay: async (userId, festivalId, date) => ({
      attendance: await attendanceRepo.getByDate(userId, festivalId, date),
      consumptions: await consumptionRepo.findByFestivalAndDate(userId, festivalId, date),
    }),
    apns: getApnsClient(),
    sendExpo: (token, data) => sendExpoDataPush(token, data),
    now: () => new Date(),
  });
}
