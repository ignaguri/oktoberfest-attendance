import { z } from "zod";

// Calendar event types
export const CalendarEventTypeSchema = z.enum([
  "attendance",
  "tent_visit",
  "beer_summary",
  "reservation",
]);

export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

// Calendar event schema
export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  from: z.string(), // ISO date string
  to: z.string().nullable().optional(),
  type: CalendarEventTypeSchema,
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// Query schemas
export const GetPersonalCalendarQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
});

export const GetGroupCalendarQuerySchema = z.object({
  groupId: z.string().uuid({ message: "Invalid group ID" }),
});

// Response schemas
export const GetCalendarEventsResponseSchema = z.object({
  events: z.array(CalendarEventSchema),
  festivalId: z.string().uuid(),
  festivalStartDate: z.string().nullable().optional(),
  festivalEndDate: z.string().nullable().optional(),
});

export type GetCalendarEventsResponse = z.infer<
  typeof GetCalendarEventsResponseSchema
>;
