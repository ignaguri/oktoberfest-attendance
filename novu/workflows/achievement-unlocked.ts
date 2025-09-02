import { StepTypeEnum } from "@novu/api/models/components";
import { z } from "zod";

import type { CreateWorkflowDto } from "@novu/api/models/components";

export const ACHIEVEMENT_UNLOCKED_WORKFLOW_ID = "achievement-unlocked" as const;

export const achievementUnlockedPayloadSchema = z.object({
  achievementName: z.string(),
  description: z.string().optional(),
  rarity: z.enum(["common", "rare", "epic"]),
  achievementId: z.string(),
});

export type AchievementUnlockedPayload = z.infer<
  typeof achievementUnlockedPayloadSchema
>;

export const achievementUnlockedWorkflow: CreateWorkflowDto = {
  workflowId: ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  name: "Achievement Unlocked",
  tags: ["achievements", "oktoberfest"],
  steps: [
    {
      id: `${ACHIEVEMENT_UNLOCKED_WORKFLOW_ID}-in-app`,
      name: "In-App Achievement",
      type: StepTypeEnum.InApp,
      controlValues: {
        subject: "Achievement unlocked: {{payload.achievementName}}",
        body: "{{payload.description}}",
      },
    },
    {
      id: `${ACHIEVEMENT_UNLOCKED_WORKFLOW_ID}-push`,
      name: "Push Achievement",
      type: StepTypeEnum.Push,
      controlValues: {
        subject: "You unlocked an achievement!",
        body: "{{payload.achievementName}} ({{payload.rarity}})",
      },
    },
  ],
  active: true,
};
