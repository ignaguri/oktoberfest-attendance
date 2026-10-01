/**
 * Usage event catalog: the single source of truth for which events exist and
 * what props each may carry. The API validates every incoming event against
 * this, and both apps' `track()` calls are typed by it.
 *
 * Adding an event: one entry in EVENT_PROPS_SCHEMAS, one call site. No
 * migration: analytics.events.name has no CHECK on purpose.
 *
 * Props must never carry free text, names, emails or other users' ids. Every
 * schema is .strict() so an extra key drops the event instead of leaking.
 */
import { z } from "zod";

import { NOTIFICATION_PUSH_TYPES, type NotificationPushType } from "../constants/notifications";

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_EVENT_PROPS_CHARS = 1024;

/** A normalized route such as "/group-detail/[id]". Never contains an id. */
const ScreenSchema = z
  .string()
  .max(100)
  .regex(/^\/[a-z0-9\-/[\]]*$/);

export const TRACKED_SHEETS = ["quick_attendance", "crowd_report"] as const;
export type TrackedSheet = (typeof TRACKED_SHEETS)[number];

export const TRACKED_PROMPTS = [
  "notification_ask",
  "crowd_report",
  "app_update",
  "festival_alert",
] as const;
export type TrackedPrompt = (typeof TRACKED_PROMPTS)[number];

export const TRACKED_EMPTY_STATES = ["groups", "friends", "leaderboard"] as const;

/** Where the Wrapped persona collection was opened from. */
export const PERSONA_COLLECTION_SOURCES = ["prost_slide", "archive", "profile"] as const;

export type PersonaCollectionSource = (typeof PERSONA_COLLECTION_SOURCES)[number];

const PUSH_TYPES = Object.values(NOTIFICATION_PUSH_TYPES) as [
  NotificationPushType,
  ...NotificationPushType[],
];

export const EVENT_PROPS_SCHEMAS = {
  screen_viewed: z.object({ screen: ScreenSchema }).strict(),
  app_opened: z.object({ source: z.enum(["cold", "resume"]) }).strict(),
  notification_opened: z
    .object({ type: z.enum(PUSH_TYPES), channel: z.enum(["push", "inbox"]) })
    .strict(),
  sheet_opened: z.object({ sheet: z.enum(TRACKED_SHEETS) }).strict(),
  sheet_abandoned: z.object({ sheet: z.enum(TRACKED_SHEETS) }).strict(),
  prompt_answered: z
    .object({
      prompt: z.enum(TRACKED_PROMPTS),
      answer: z.enum(["accepted", "dismissed"]),
    })
    .strict(),
  tutorial_step: z
    .object({
      step: z.string().regex(/^[a-z0-9-]{1,40}$/),
      action: z.enum(["viewed", "skipped", "completed"]),
    })
    .strict(),
  empty_state_seen: z.object({ screen: z.enum(TRACKED_EMPTY_STATES) }).strict(),
  persona_collection_opened: z.object({ source: z.enum(PERSONA_COLLECTION_SOURCES) }).strict(),
  error_shown: z
    .object({
      screen: ScreenSchema,
      code: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    })
    .strict(),
} as const;

export type EventName = keyof typeof EVENT_PROPS_SCHEMAS;
export type EventProps<N extends EventName> = z.infer<(typeof EVENT_PROPS_SCHEMAS)[N]>;
export const EVENT_NAMES = Object.keys(EVENT_PROPS_SCHEMAS) as EventName[];

/**
 * One queued event on the wire. The envelope is validated strictly (a bad
 * envelope is a client bug and 400s the batch); name and props are validated
 * per event by parseTrackedEvent, so one bad event never costs the batch.
 * user_id is deliberately absent: the API takes it from the token, and zod
 * strips unknown keys.
 */
export const TrackedEventSchema = z.object({
  name: z.string().max(64),
  props: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().max(40),
  sessionId: z.uuid(),
});
export type TrackedEvent = z.infer<typeof TrackedEventSchema>;

export const RecordEventsBodySchema = z.object({
  events: z.array(TrackedEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type RecordEventsBody = z.infer<typeof RecordEventsBodySchema>;

export const RecordEventsResponseSchema = z.object({
  accepted: z.number().int(),
});
export type RecordEventsResponse = z.infer<typeof RecordEventsResponseSchema>;

function isEventName(name: string): name is EventName {
  return Object.hasOwn(EVENT_PROPS_SCHEMAS, name);
}

/** The event's validated name and props, or null when it must be dropped. */
export function parseTrackedEvent(
  event: TrackedEvent,
): { name: EventName; props: Record<string, unknown> } | null {
  if (!isEventName(event.name)) {
    return null;
  }
  const props = event.props ?? {};
  if (JSON.stringify(props).length > MAX_EVENT_PROPS_CHARS) {
    return null;
  }
  const result = EVENT_PROPS_SCHEMAS[event.name].safeParse(props);
  if (!result.success) {
    return null;
  }
  return { name: event.name, props: result.data as Record<string, unknown> };
}

/** Any error code squeezed into the error_shown.code format. */
export function toEventCode(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "UNKNOWN";
  }
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 40);
}
