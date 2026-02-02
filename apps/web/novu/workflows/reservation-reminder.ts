import { workflow } from "@novu/framework";
import { z } from "zod";

export const RESERVATION_REMINDER_WORKFLOW_ID =
  "reservation-reminder-notification" as const;

export const reservationReminderPayloadSchema = z.object({
  userName: z.string().describe("Name of the user with the reservation"),
  tentName: z.string().describe("Name of the tent where reservation is"),
  reservationTime: z.string().describe("Time of the reservation"),
  tableNumber: z.string().optional().describe("Table number if assigned"),
  partySize: z.number().describe("Number of people in the party"),
  reservationId: z
    .string()
    .optional()
    .describe("ID of the reservation for deep linking"),
});

export type ReservationReminderPayload = z.infer<
  typeof reservationReminderPayloadSchema
>;

export const reservationReminderWorkflow = workflow(
  RESERVATION_REMINDER_WORKFLOW_ID,
  async ({
    step,
    payload,
  }: {
    step: any;
    payload: ReservationReminderPayload;
  }) => {
    await step.inApp(
      "in-app-notification",
      async (controls: any) => {
        const urgency =
          controls.urgencyLevel === "high"
            ? "🚨 "
            : controls.urgencyLevel === "medium"
              ? "⚠️ "
              : "";
        return {
          subject:
            controls.subject ||
            `${urgency}Reservation reminder for ${payload.tentName}`,
          body:
            controls.body ||
            `${urgency}Don't forget! You have a reservation for ${payload.partySize} at ${payload.tentName} at ${payload.reservationTime}`,
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("Reservation reminder for {{tentName}}")
            .describe("Reminder notification title"),
          body: z
            .string()
            .default(
              "Don't forget! You have a reservation for {{partySize}} at {{tentName}} at {{reservationTime}}",
            )
            .describe("Reminder notification message"),
          urgencyLevel: z
            .enum(["low", "medium", "high"])
            .default("medium")
            .describe("Urgency level for the reminder"),
          showPartySize: z
            .boolean()
            .default(true)
            .describe("Show party size in message"),
        }),
      },
    );

    await step.push(
      "push-notification",
      async (controls: any) => {
        const timeLeft = controls.timeLeft || "30 minutes";
        return {
          subject: controls.pushSubject || `Reservation in ${timeLeft}`,
          body:
            controls.pushBody ||
            `Your table at ${payload.tentName} is ready at ${payload.reservationTime}`,
          data: {
            type: "reservation-reminder",
            reservationId: payload.reservationId,
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("Reservation in 30 minutes")
            .describe("Push notification title"),
          pushBody: z
            .string()
            .default(
              "Your table at {{tentName}} is ready at {{reservationTime}}",
            )
            .describe("Push notification message"),
          timeLeft: z
            .string()
            .default("30 minutes")
            .describe("Time remaining until reservation"),
        }),
      },
    );
  },
  {
    payloadSchema: reservationReminderPayloadSchema,
    tags: ["reservations", "reminders", "oktoberfest"],
  },
);
