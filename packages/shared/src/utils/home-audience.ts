/**
 * Who Home treats as a solo user. Friends and group members are where feed
 * content comes from, so someone with neither gets the expanded personal
 * progress card. The API runs this, so changing the thresholds (or adding an
 * input) ships with a deploy, no migration or OTA.
 */
export const SOLO_MAX_GROUPS = 0;
export const SOLO_MAX_FRIENDS = 0;

export type HomeAudience = "solo" | "social";

export interface HomeAudienceInput {
  /** Groups of the current festival the user belongs to */
  groupCount: number;
  /** Accepted friendships */
  friendCount: number;
}

export function classifyHomeAudience(input: HomeAudienceInput): HomeAudience {
  if (input.groupCount <= SOLO_MAX_GROUPS && input.friendCount <= SOLO_MAX_FRIENDS) {
    return "solo";
  }
  return "social";
}
