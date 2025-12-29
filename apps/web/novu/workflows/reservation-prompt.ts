import { workflow } from "@novu/framework";
import { z } from "zod";

export const RESERVATION_PROMPT_WORKFLOW_ID =
  "reservation-check-in-prompt" as const;

export const reservationPromptPayloadSchema = z.object({
  userName: z.string().describe("Name of the user to prompt"),
  tentName: z.string().describe("Name of the tent with reservation"),
  reservationTime: z.string().describe("Time of the reservation"),
});

export type ReservationPromptPayload = z.infer<
  typeof reservationPromptPayloadSchema
>;

export const reservationPromptWorkflow = workflow(
  RESERVATION_PROMPT_WORKFLOW_ID,
  async ({
    step,
    payload,
  }: {
    step: any;
    payload: ReservationPromptPayload;
  }) => {
    await step.inApp("in-app-notification", async (controls: any) => {
      return {
        subject: `Did you make it to ${payload.tentName}?`,
        body: `We noticed you had a reservation at ${payload.tentName} at ${payload.reservationTime}. Check in to track your visit!`,
        primaryAction: {
          label: "Check In",
          redirect: {
            url: "/attendance",
          },
        },
        secondaryAction: {
          label: "Not Today",
        },
      };
    });
  },
  {
    payloadSchema: reservationPromptPayloadSchema,
    tags: ["reservations", "checkin", "oktoberfest"],
  },
);
