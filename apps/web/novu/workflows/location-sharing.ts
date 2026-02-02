import { workflow } from "@novu/framework";
import { z } from "zod";

export const LOCATION_SHARING_WORKFLOW_ID =
  "location-sharing-notification" as const;

export const locationSharingPayloadSchema = z.object({
  sharerName: z.string().describe("Name of the user sharing their location"),
  groupName: z.string().describe("Name of the group"),
  sharerAvatar: z
    .string()
    .optional()
    .describe("URL of the sharer's avatar image"),
  groupId: z.string().describe("Unique identifier of the group"),
  action: z
    .enum(["started", "stopped"])
    .describe("Whether location sharing was started or stopped"),
  festivalName: z.string().optional().describe("Name of the current festival"),
});

export type LocationSharingPayload = z.infer<
  typeof locationSharingPayloadSchema
>;

export const locationSharingWorkflow = workflow(
  LOCATION_SHARING_WORKFLOW_ID,
  async ({ step, payload }: { step: any; payload: LocationSharingPayload }) => {
    const actionText = payload.action === "started" ? "started" : "stopped";
    const actionEmoji = payload.action === "started" ? "📍" : "🚫";

    await step.inApp(
      "in-app-notification",
      async (controls: any) => {
        return {
          subject:
            controls.subject ||
            `${actionEmoji} ${payload.sharerName} ${actionText} sharing location`,
          body:
            controls.body ||
            `${payload.sharerName} ${actionText} sharing their live location in ${payload.groupName}${payload.festivalName ? ` at ${payload.festivalName}` : ""}`,
          avatar: payload.sharerAvatar,
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("📍 {{sharerName}} {{action}} sharing location")
            .describe("Notification subject"),
          body: z
            .string()
            .default(
              "{{sharerName}} {{action}} sharing their live location in {{groupName}}",
            )
            .describe("Notification message"),
        }),
      },
    );

    await step.push(
      "push-notification",
      async (controls: any) => {
        return {
          subject: controls.pushSubject || `Location sharing ${actionText}`,
          body:
            controls.pushBody ||
            `${payload.sharerName} ${actionText} sharing location in ${payload.groupName}`,
          data: {
            type: "group-check-in",
            groupId: payload.groupId,
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("Location sharing {{action}}")
            .describe("Push notification title"),
          pushBody: z
            .string()
            .default(
              "{{sharerName}} {{action}} sharing location in {{groupName}}",
            )
            .describe("Push notification message"),
        }),
      },
    );
  },
  {
    payloadSchema: locationSharingPayloadSchema,
    tags: ["location", "groups", "social", "oktoberfest"],
  },
);
