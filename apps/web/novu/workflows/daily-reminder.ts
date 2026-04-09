import { workflow } from "@novu/framework";
import { z } from "zod";

export const DAILY_REMINDER_WORKFLOW_ID = "daily-reminder" as const;

export const dailyReminderPayloadSchema = z.object({
  userName: z.string().optional().describe("Name of the user"),
  dayOfYear: z.number().describe("Day of year for rotating messages"),
});

export type DailyReminderPayload = z.infer<typeof dailyReminderPayloadSchema>;

const MOTIVATIONAL_MESSAGES = [
  {
    subject: "Time to check in! 🍺",
    body: "Your Oktoberfest stats await — open ProstCounter today!",
  },
  {
    subject: "Prost! 🥨",
    body: "Don't break your streak — open ProstCounter today!",
  },
  {
    subject: "Your friends miss you! 🎪",
    body: "Your beer tent friends are waiting — check in on ProstCounter!",
  },
  {
    subject: "Keep the spirit alive! 🎶",
    body: "Keep the festival spirit going — open ProstCounter today!",
  },
  {
    subject: "Another day, another Maß! 🍻",
    body: "Log your festival adventures — open ProstCounter!",
  },
  {
    subject: "Defend your position! 🏆",
    body: "Your leaderboard position needs defending — open ProstCounter!",
  },
  {
    subject: "Gemütlichkeit awaits! 🇩🇪",
    body: "The festival fun continues — open ProstCounter today!",
  },
];

export const dailyReminderWorkflow = workflow(
  DAILY_REMINDER_WORKFLOW_ID,
  async ({ step, payload }: { step: any; payload: DailyReminderPayload }) => {
    await step.push(
      "push-notification",
      async (controls: any) => {
        const messageIndex = payload.dayOfYear % MOTIVATIONAL_MESSAGES.length;
        const message = MOTIVATIONAL_MESSAGES[messageIndex];

        return {
          subject: controls.pushSubject || message.subject,
          body: controls.pushBody || message.body,
          data: {
            type: "daily-reminder",
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("")
            .describe(
              "Push notification title (leave empty for rotating messages)",
            ),
          pushBody: z
            .string()
            .default("")
            .describe(
              "Push notification body (leave empty for rotating messages)",
            ),
        }),
      },
    );
  },
  {
    payloadSchema: dailyReminderPayloadSchema,
    tags: ["reminders", "daily", "testing"],
  },
);
