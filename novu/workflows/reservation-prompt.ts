import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const RESERVATION_PROMPT_WORKFLOW_ID =
  "reservation-check-in-prompt" as const;

export const reservationPromptPayloadSchema = z.object({
  tentName: z.string(),
  reservationId: z.string(),
  deepLinkUrl: z.string(),
});

export type ReservationPromptPayload = z.infer<
  typeof reservationPromptPayloadSchema
>;

export const reservationPromptWorkflow: CreateWorkflowDto = {
  workflowId: RESERVATION_PROMPT_WORKFLOW_ID,
  name: "Reservation Check-in Prompt",
  tags: ["reservations", "prompts", "oktoberfest"],
  steps: [
    {
      id: `${RESERVATION_PROMPT_WORKFLOW_ID}-in-app`,
      name: "In-App Prompt",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject: "Are you at {{payload.tentName}}?",
        body: "Tap to check in now. If you are there, confirm and we'll log your attendance.",
        primaryAction: { label: "Check in", url: "{{payload.deepLinkUrl}}" },
      },
    },
    {
      id: `${RESERVATION_PROMPT_WORKFLOW_ID}-push`,
      name: "Push Prompt",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "Are you there yet?",
        body: "Check in at {{payload.tentName}}",
      },
    },
  ],
  active: true,
};
