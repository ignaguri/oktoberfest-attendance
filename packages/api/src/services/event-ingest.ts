/**
 * Turns a client batch into rows for analytics_record_events: per-event
 * validation against the shared catalog and clock clamping. Invalid events are
 * dropped one by one; one bad event never costs the batch.
 */
import { type EventName, parseTrackedEvent, type TrackedEvent } from "@prostcounter/shared";

export const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

export interface PreparedEvent {
  name: EventName;
  props: Record<string, unknown>;
  occurred_at: string;
  session_id: string;
}

/** Client clock clamped to [now - 24h, now]; null when unparseable. */
export function clampOccurredAt(raw: string, now: Date): string | null {
  const parsedMs = Date.parse(raw);
  if (Number.isNaN(parsedMs)) {
    return null;
  }
  const nowMs = now.getTime();
  const clampedMs = Math.min(Math.max(parsedMs, nowMs - MAX_EVENT_AGE_MS), nowMs);
  return new Date(clampedMs).toISOString();
}

export function prepareEvents(events: TrackedEvent[], now: Date): PreparedEvent[] {
  const prepared: PreparedEvent[] = [];
  for (const event of events) {
    const parsed = parseTrackedEvent(event);
    if (!parsed) {
      continue;
    }
    const occurredAt = clampOccurredAt(event.occurredAt, now);
    if (!occurredAt) {
      continue;
    }
    prepared.push({
      name: parsed.name,
      props: parsed.props,
      occurred_at: occurredAt,
      session_id: event.sessionId,
    });
  }
  return prepared;
}
