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
  inviteToken?: string;
  url?: string;
  [key: string]: unknown;
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
    }
  }

  // Fallback: infer route from payload shape (for in-app notifications)
  if (payload.achievementName) return "/achievements";
  if (payload.senderName && !payload.groupId) return "/friends?tab=requests";
  // Before the groupId fallback: a push step's schema is {skip, subject, body},
  // so it cannot carry data.type and the raw trigger payload arrives instead.
  // A carry-over payload has both, and the recipient is not a member yet, so
  // the invite link has to win over /group-detail.
  if (payload.inviteToken) return `/join-group?token=${payload.inviteToken}`;
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
