import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const GROUP_JOIN_WORKFLOW_ID = "group-join-notification" as const;

export const groupJoinPayloadSchema = z.object({
  joinerName: z.string(),
  groupName: z.string(),
  joinerAvatar: z.string().optional(),
  groupId: z.string(),
});

export type GroupJoinPayload = z.infer<typeof groupJoinPayloadSchema>;

export const groupJoinWorkflow: CreateWorkflowDto = {
  workflowId: GROUP_JOIN_WORKFLOW_ID,
  name: "Group Join Notification",
  tags: ["groups", "social", "oktoberfest"],
  steps: [
    {
      id: `${GROUP_JOIN_WORKFLOW_ID}-in-app`,
      name: "In-App Notification",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject: "{{payload.joinerName}} joined {{payload.groupName}}",
        body: "{{payload.joinerName}} just joined {{payload.groupName}}. Say hi!",
        avatar: "{{payload.joinerAvatar}}",
      },
    },
    {
      id: `${GROUP_JOIN_WORKFLOW_ID}-push`,
      name: "Push Notification",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "New member in your group",
        body: "{{payload.joinerName}} joined {{payload.groupName}}",
      },
    },
  ],
  active: true,
};
