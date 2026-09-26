/**
 * Notification System Registry
 *
 * Single source of truth for all notification workflow IDs, push types,
 * and routing logic. Used by:
 * - API service (triggering workflows)
 * - Mobile push handler (routing from push taps)
 * - Mobile inbox (routing from in-app notification taps)
 * - Web notification bell (redirect URLs)
 * - Novu workflow files (workflow ID constants)
 */

// =============================================================================
// Workflow IDs - match exactly what's configured in Novu dashboard
// =============================================================================

export const NOTIFICATION_WORKFLOWS = {
  GROUP_JOIN: "group-join-notification",
  LOCATION_SHARING: "location-sharing-notification",
  TENT_CHECKIN: "tent-check-in-notification",
  RESERVATION_REMINDER: "reservation-reminder-notification",
  RESERVATION_CHECKIN_PROMPT: "reservation-check-in-prompt",
  ACHIEVEMENT_UNLOCKED: "achievement-unlocked",
  GROUP_ACHIEVEMENT_UNLOCKED: "group-achievement-unlocked",
  FRIEND_REQUEST: "friend-request",
  GROUP_CARRY_OVER: "group-carryover-invite",
  FESTIVAL_OPENING: "festival-opening",
  FRIEND_PLAN_OVERLAP: "friend-plan-overlap",
  GROUP_JOIN_REQUEST: "group-join-request",
  GROUP_JOIN_REQUEST_ACCEPTED: "group-join-request-accepted",
  DAY_START: "day-start",
  GROUP_MESSAGE: "group-message",
  GROUP_INVITATION: "group-invitation",
  GROUP_INVITATION_ACCEPTED: "group-invitation-accepted",
  PHOTO_REACTION: "photo-reaction",
  PHOTO_TAG: "photo-tag",
} as const;

export type NotificationWorkflowId =
  (typeof NOTIFICATION_WORKFLOWS)[keyof typeof NOTIFICATION_WORKFLOWS];

// =============================================================================
// Push notification data.type values - used in push step data field
// =============================================================================

export const NOTIFICATION_PUSH_TYPES = {
  GROUP_JOIN: "group-join",
  LOCATION_SHARING: "location-sharing",
  TENT_CHECKIN: "tent-check-in",
  RESERVATION_REMINDER: "reservation-reminder",
  RESERVATION_CHECKIN_PROMPT: "reservation-check-in-prompt",
  ACHIEVEMENT_UNLOCKED: "achievement-unlocked",
  GROUP_ACHIEVEMENT_UNLOCKED: "group-achievement-unlocked",
  FRIEND_REQUEST: "friend-request",
  GROUP_CARRY_OVER: "group-carry-over",
  FRIEND_PLAN_OVERLAP: "friend-plan-overlap",
  GROUP_JOIN_REQUEST: "group-join-request",
  GROUP_JOIN_REQUEST_ACCEPTED: "group-join-request-accepted",
  DAY_START: "day-start",
  GROUP_MESSAGE: "group-message",
  GROUP_INVITATION: "group-invitation",
  GROUP_INVITATION_ACCEPTED: "group-invitation-accepted",
  PHOTO_REACTION: "photo-reaction",
  PHOTO_TAG: "photo-tag",
} as const;

export type NotificationPushType =
  (typeof NOTIFICATION_PUSH_TYPES)[keyof typeof NOTIFICATION_PUSH_TYPES];

// =============================================================================
// Route resolver - maps notification type/payload to navigation route
// =============================================================================

interface NotificationPayload {
  type?: string;
  groupId?: string;
  reservationId?: string;
  achievementName?: string;
  senderName?: string;
  inviterName?: string;
  inviteToken?: string;
  url?: string;
  actorName?: string;
  date?: string;
  festivalId?: string;
  reactorName?: string;
  taggerName?: string;
  [key: string]: unknown;
}

/**
 * The attendance day a plan overlap points at. The festival rides along because
 * festivals can share dates, and the day must open in the one it was planned for.
 */
function buildDayRoute(date: string, festivalId: string | undefined): string {
  return festivalId
    ? `/attendance?date=${date}&festivalId=${festivalId}`
    : `/attendance?date=${date}`;
}

/**
 * Resolve the navigation route for a notification.
 *
 * Works with both:
 * - Push notification data (has `type` field)
 * - Novu in-app notification payload (has workflow-specific fields)
 *
 * @returns Route path string, or null if no specific route
 */
export function getNotificationRoute(payload: NotificationPayload): string | null {
  const type = payload.type;

  // Route by explicit push type first
  if (type) {
    switch (type) {
      case NOTIFICATION_PUSH_TYPES.GROUP_JOIN:
        return payload.groupId ? `/group-detail/${payload.groupId}` : "/groups";

      // The recipient is not a member of the cloned group yet, so this must
      // route to the join link, never to the group detail page. Query form, not
      // /join-group/<token>: this string is fed straight to router.push on both
      // platforms, and web only has apps/web/app/(private)/join-group/page.tsx,
      // which reads ?token=. Mobile's join-group/index.tsx accepts the query
      // form and redirects to its own [token] route.
      case NOTIFICATION_PUSH_TYPES.GROUP_CARRY_OVER:
        return payload.inviteToken ? `/join-group?token=${payload.inviteToken}` : "/groups";

      case NOTIFICATION_PUSH_TYPES.TENT_CHECKIN:
      case NOTIFICATION_PUSH_TYPES.LOCATION_SHARING:
        return payload.groupId ? `/group-detail/${payload.groupId}` : "/home";

      case NOTIFICATION_PUSH_TYPES.ACHIEVEMENT_UNLOCKED:
        return "/achievements";

      case NOTIFICATION_PUSH_TYPES.FRIEND_REQUEST:
        return "/friends?tab=requests";

      case NOTIFICATION_PUSH_TYPES.RESERVATION_REMINDER:
      case NOTIFICATION_PUSH_TYPES.RESERVATION_CHECKIN_PROMPT:
        return payload.reservationId
          ? `/attendance?checkInReservationId=${payload.reservationId}`
          : "/attendance";

      case NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP:
        return payload.date ? buildDayRoute(payload.date, payload.festivalId) : "/attendance";

      case NOTIFICATION_PUSH_TYPES.DAY_START:
        return "/home";

      // The creator reviews requests in the group's settings
      case NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST:
        return payload.groupId ? `/group-detail/${payload.groupId}/settings` : "/groups";

      case NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST_ACCEPTED:
        return payload.groupId ? `/group-detail/${payload.groupId}` : "/groups";

      // groupId is a best-effort deep link (the first shared group found for
      // this recipient); omitted when it couldn't be resolved, so fall back
      // to the groups list rather than a broken group-detail route.
      case NOTIFICATION_PUSH_TYPES.GROUP_MESSAGE:
        return payload.groupId ? `/group-detail/${payload.groupId}/messages` : "/groups";

      // The invitee is not a member yet, so this must land on the groups list,
      // where the pending-invitations section is, and never on /group-detail
      case NOTIFICATION_PUSH_TYPES.GROUP_INVITATION:
        return "/groups";

      case NOTIFICATION_PUSH_TYPES.GROUP_INVITATION_ACCEPTED:
        return payload.groupId ? `/group-detail/${payload.groupId}` : "/groups";

      // The group the reaction was made in; its gallery shows the photo
      case NOTIFICATION_PUSH_TYPES.PHOTO_REACTION:
        return payload.groupId ? `/group-detail/${payload.groupId}/gallery` : "/groups";

      // The tagger's shared group shows the photo; without one, the tagged
      // person's own profile strip does
      case NOTIFICATION_PUSH_TYPES.PHOTO_TAG:
        return payload.groupId ? `/group-detail/${payload.groupId}/gallery` : "/profile";
    }
  }

  // Fallback: infer route from payload shape (for in-app notifications)
  if (payload.achievementName) return "/achievements";
  // An in-app overlap notification carries its trigger payload, not a type.
  if (payload.actorName && payload.date) return buildDayRoute(payload.date, payload.festivalId);
  if (payload.senderName && !payload.groupId) return "/friends?tab=requests";
  // An invitation names its inviter and group. It has to beat the groupId
  // fallback below, because the invitee cannot open the group yet.
  if (payload.inviterName && payload.groupId) return "/groups";
  // A join request names its requester and group; the creator reviews it in settings
  if (payload.requesterName && payload.groupId) return `/group-detail/${payload.groupId}/settings`;
  // Before the groupId fallback: a push step's schema is {skip, subject, body},
  // so it cannot carry data.type and the raw trigger payload arrives instead.
  // A carry-over payload has both, and the recipient is not a member yet, so
  // the invite link has to win over /group-detail.
  if (payload.inviteToken) return `/join-group?token=${payload.inviteToken}`;
  // A reaction names its reactor and group, and belongs in the gallery
  if (payload.reactorName && payload.groupId) return `/group-detail/${payload.groupId}/gallery`;
  // A tag names its tagger; it must beat the groupId fallback below
  if (payload.taggerName) {
    return payload.groupId ? `/group-detail/${payload.groupId}/gallery` : "/profile";
  }
  if (payload.groupId) return `/group-detail/${payload.groupId}`;

  // Try URL if present
  if (payload.url && typeof payload.url === "string") {
    // App-relative URLs can be used as-is
    if (payload.url.startsWith("/")) {
      return payload.url;
    }
    try {
      const parsed = new URL(payload.url);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      // Invalid URL
    }
  }

  return null;
}
