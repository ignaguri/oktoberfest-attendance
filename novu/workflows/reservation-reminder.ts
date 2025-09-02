import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const RESERVATION_REMINDER_WORKFLOW_ID =
  "reservation-reminder-notification" as const;

export const reservationReminderPayloadSchema = z.object({
  userName: z.string().optional(),
  tentName: z.string(),
  startAtISO: z.string(),
  reservationId: z.string(),
  festivalName: z.string().optional(),
});

export type ReservationReminderPayload = z.infer<
  typeof reservationReminderPayloadSchema
>;

export const reservationReminderWorkflow: CreateWorkflowDto = {
  workflowId: RESERVATION_REMINDER_WORKFLOW_ID,
  name: "Reservation Reminder",
  tags: ["reservations", "reminders", "oktoberfest"],
  steps: [
    {
      id: `${RESERVATION_REMINDER_WORKFLOW_ID}-in-app`,
      name: "In-App Reminder",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject: "Reminder: Your table at {{payload.tentName}} is coming up",
        body: "You have a reservation at {{payload.tentName}} on {{payload.startAtISO}}. Don't forget!",
      },
    },
    {
      id: `${RESERVATION_REMINDER_WORKFLOW_ID}-push`,
      name: "Push Reminder",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "Reservation reminder",
        body: "Reservation at {{payload.tentName}} on {{payload.startAtISO}}",
      },
    },
  ],
  active: true,
};
