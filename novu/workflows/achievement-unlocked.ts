import { workflow } from "@novu/framework";
import { z } from "zod";

export const ACHIEVEMENT_UNLOCKED_WORKFLOW_ID = "achievement-unlocked" as const;

export const achievementUnlockedPayloadSchema = z.object({
  userName: z
    .string()
    .describe("Name of the user who unlocked the achievement"),
  achievementName: z.string().describe("Name of the achievement"),
  achievementDescription: z
    .string()
    .describe("Description of what was achieved"),
  achievementIcon: z
    .string()
    .optional()
    .describe("Icon/emoji for the achievement"),
  unlockedAt: z.string().describe("When the achievement was unlocked"),
});

export type AchievementUnlockedPayload = z.infer<
  typeof achievementUnlockedPayloadSchema
>;

export const achievementUnlockedWorkflow = workflow(
  ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  async ({
    step,
    payload,
  }: {
    step: any;
    payload: AchievementUnlockedPayload;
  }) => {
    await step.inApp(
      "in-app-notification",
      async (controls: any) => {
        const celebration = controls.celebrationEmoji || "🎉";
        const icon = payload.achievementIcon || controls.defaultIcon || "🏆";
        return {
          subject: controls.subject || `${icon} Achievement Unlocked!`,
          body:
            controls.body ||
            `${celebration} Congratulations! You've unlocked "${payload.achievementName}" - ${payload.achievementDescription}`,
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("{{achievementIcon}} Achievement Unlocked!")
            .describe("Achievement notification title"),
          body: z
            .string()
            .default(
              '🎉 Congratulations! You\'ve unlocked "{{achievementName}}" - {{achievementDescription}}',
            )
            .describe("Achievement notification message"),
          celebrationEmoji: z
            .string()
            .default("🎉")
            .describe("Celebration emoji to use"),
          defaultIcon: z
            .string()
            .default("🏆")
            .describe("Default achievement icon if none provided"),
          showCongrats: z
            .boolean()
            .default(true)
            .describe("Show congratulations message"),
        }),
      },
    );

    await step.push(
      "push-notification",
      async (controls: any) => {
        const icon = payload.achievementIcon || controls.defaultIcon || "🏆";
        return {
          subject: controls.pushSubject || `${icon} Achievement Unlocked!`,
          body:
            controls.pushBody || `You've unlocked "${payload.achievementName}"`,
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("{{achievementIcon}} Achievement Unlocked!")
            .describe("Push notification title"),
          pushBody: z
            .string()
            .default('You\'ve unlocked "{{achievementName}}"')
            .describe("Push notification message"),
          defaultIcon: z
            .string()
            .default("🏆")
            .describe("Default achievement icon for push"),
        }),
      },
    );
  },
  {
    payloadSchema: achievementUnlockedPayloadSchema,
    tags: ["achievements", "gamification", "oktoberfest"],
  },
);
