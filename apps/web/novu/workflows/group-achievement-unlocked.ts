import { workflow } from "@novu/framework";
import { z } from "zod";

export const GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID =
  "group-achievement-unlocked" as const;

export const groupAchievementUnlockedPayloadSchema = z.object({
  groupName: z
    .string()
    .describe("Name of the group that unlocked the achievement"),
  achievementName: z.string().describe("Name of the achievement"),
  achievementDescription: z
    .string()
    .describe("Description of what was achieved"),
  achievementIcon: z
    .string()
    .optional()
    .describe("Icon/emoji for the achievement"),
  contributorName: z
    .string()
    .describe("Name of the member who contributed to unlocking"),
  unlockedAt: z.string().describe("When the achievement was unlocked"),
});

export type GroupAchievementUnlockedPayload = z.infer<
  typeof groupAchievementUnlockedPayloadSchema
>;

export const groupAchievementUnlockedWorkflow = workflow(
  GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  async ({
    step,
    payload,
  }: {
    step: any;
    payload: GroupAchievementUnlockedPayload;
  }) => {
    await step.inApp("in-app-notification", async (_controls: any) => {
      return {
        subject: `${payload.achievementIcon} Group Achievement Unlocked!`,
        body: `Your group "${payload.groupName}" has unlocked "${payload.achievementName}" - ${payload.achievementDescription}. Thanks to ${payload.contributorName}!`,
      };
    });

    await step.push("push-notification", async (_controls: any) => {
      return {
        subject: "Group Achievement!",
        body: `${payload.groupName} unlocked "${payload.achievementName}"`,
        data: {
          type: "achievement-unlocked",
        },
      };
    });
  },
  {
    payloadSchema: groupAchievementUnlockedPayloadSchema,
    tags: ["achievements", "groups", "gamification", "oktoberfest"],
  },
);
