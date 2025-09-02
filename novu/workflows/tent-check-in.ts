import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const TENT_CHECKIN_WORKFLOW_ID = "tent-check-in-notification" as const;

export const tentCheckinPayloadSchema = z.object({
  userName: z.string(),
  tentName: z.string(),
  userAvatar: z.string().optional(),
  groupName: z.string(),
});

export type TentCheckinPayload = z.infer<typeof tentCheckinPayloadSchema>;

export const tentCheckinWorkflow: CreateWorkflowDto = {
  workflowId: TENT_CHECKIN_WORKFLOW_ID,
  name: "Tent Check-in Notification",
  tags: ["groups", "social", "oktoberfest", "tents"],
  steps: [
    {
      id: `${TENT_CHECKIN_WORKFLOW_ID}-in-app`,
      name: "In-App Notification",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject: "{{payload.userName}} is at {{payload.tentName}}!",
        body: '{{payload.userName}} (from group "{{payload.groupName}}") just checked into {{payload.tentName}}. Join them for some fun! 🍻',
        avatar: "{{payload.userAvatar}}",
      },
    },
    {
      id: `${TENT_CHECKIN_WORKFLOW_ID}-push`,
      name: "Push Notification",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "Group Member Check-in!",
        body: "{{payload.userName}} is at {{payload.tentName}} with {{payload.groupName}}",
      },
    },
  ],
  active: true,
};
