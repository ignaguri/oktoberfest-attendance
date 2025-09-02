import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID =
  "group-achievement-unlocked" as const;

export const groupAchievementUnlockedPayloadSchema = z.object({
  achieverName: z.string(),
  achievementName: z.string(),
  rarity: z.enum(["rare", "epic"]),
  groupName: z.string().optional(),
});

export type GroupAchievementUnlockedPayload = z.infer<
  typeof groupAchievementUnlockedPayloadSchema
>;

export const groupAchievementUnlockedWorkflow: CreateWorkflowDto = {
  workflowId: GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  name: "Group Achievement Unlocked",
  tags: ["achievements", "groups", "oktoberfest"],
  steps: [
    {
      id: `${GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID}-in-app`,
      name: "In-App Group Achievement",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject:
          "{{payload.achieverName}} unlocked {{payload.achievementName}}!",
        body: "{{payload.achieverName}} reached {{payload.achievementName}} ({{payload.rarity}})",
      },
    },
    {
      id: `${GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID}-push`,
      name: "Push Group Achievement",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "Group achievement",
        body: "{{payload.achieverName}} unlocked {{payload.achievementName}} ({{payload.rarity}})",
      },
    },
  ],
  active: true,
};
