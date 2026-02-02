import { workflow } from "@novu/framework";
import { z } from "zod";

export const GROUP_JOIN_WORKFLOW_ID = "group-join-notification" as const;

export const groupJoinPayloadSchema = z.object({
  joinerName: z.string().describe("Name of the user joining the group"),
  groupName: z.string().describe("Name of the group being joined"),
  joinerAvatar: z
    .string()
    .optional()
    .describe("URL of the joiner's avatar image"),
  groupId: z.string().describe("Unique identifier of the group"),
});

export type GroupJoinPayload = z.infer<typeof groupJoinPayloadSchema>;

export const groupJoinWorkflow = workflow(
  GROUP_JOIN_WORKFLOW_ID,
  async ({ step, payload }: { step: any; payload: GroupJoinPayload }) => {
    await step.inApp(
      "in-app-notification",
      async (controls: any) => {
        return {
          subject:
            controls.subject ||
            `${payload.joinerName} joined ${payload.groupName}`,
          body:
            controls.body ||
            `${payload.joinerName} just joined ${payload.groupName}. Say hi!`,
          avatar: payload.joinerAvatar,
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("{{joinerName}} joined {{groupName}}")
            .describe("Notification subject"),
          body: z
            .string()
            .default("{{joinerName}} just joined {{groupName}}. Say hi!")
            .describe("Notification message"),
        }),
      },
    );

    await step.push(
      "push-notification",
      async (controls: any) => {
        return {
          subject: controls.pushSubject || "New member in your group",
          body:
            controls.pushBody ||
            `${payload.joinerName} joined ${payload.groupName}`,
          data: {
            type: "group-join",
            groupId: payload.groupId,
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("New member in your group")
            .describe("Push notification title"),
          pushBody: z
            .string()
            .default("{{joinerName}} joined {{groupName}}")
            .describe("Push notification message"),
        }),
      },
    );
  },
  {
    payloadSchema: groupJoinPayloadSchema,
    tags: ["groups", "social", "oktoberfest"],
  },
);
