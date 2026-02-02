import { workflow } from "@novu/framework";
import { z } from "zod";

export const TENT_CHECKIN_WORKFLOW_ID = "tent-check-in-notification" as const;

export const tentCheckinPayloadSchema = z.object({
  tentName: z.string().describe("Name of the tent being checked into"),
  userName: z.string().describe("Name of the user checking in"),
  checkInTime: z.string().describe("Time of check-in"),
  beersCount: z.number().describe("Number of beers logged"),
  groupName: z.string().optional().describe("Name of the user's group"),
});

export type TentCheckinPayload = z.infer<typeof tentCheckinPayloadSchema>;

export const tentCheckinWorkflow = workflow(
  TENT_CHECKIN_WORKFLOW_ID,
  async ({ step, payload }: { step: any; payload: TentCheckinPayload }) => {
    await step.inApp(
      "in-app-notification",
      async (controls: any) => {
        return {
          subject:
            controls.subject ||
            `${payload.userName} checked in at ${payload.tentName}`,
          body:
            controls.body ||
            `Just logged ${payload.beersCount} 🍺 at ${payload.tentName} at ${payload.checkInTime}`,
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("{{userName}} checked in at {{tentName}}")
            .describe("Check-in notification title"),
          body: z
            .string()
            .default(
              "Just logged {{beersCount}} 🍺 at {{tentName}} at {{checkInTime}}",
            )
            .describe("Check-in notification message"),
          showEmoji: z
            .boolean()
            .default(true)
            .describe("Show beer emoji in message"),
        }),
      },
    );

    await step.push(
      "push-notification",
      async (controls: any) => {
        const emoji = controls.showEmoji ? " 🍺" : "";
        return {
          subject: controls.pushSubject || "Tent check-in",
          body:
            controls.pushBody ||
            `${payload.userName} is at ${payload.tentName} with ${payload.beersCount}${emoji}`,
          data: {
            type: "tent-check-in",
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z
            .string()
            .default("Tent check-in")
            .describe("Push notification title"),
          pushBody: z
            .string()
            .default("{{userName}} is at {{tentName}} with {{beersCount}} 🍺")
            .describe("Push notification message"),
          showEmoji: z
            .boolean()
            .default(true)
            .describe("Show beer emoji in push message"),
        }),
      },
    );
  },
  {
    payloadSchema: tentCheckinPayloadSchema,
    tags: ["checkin", "tents", "oktoberfest"],
  },
);
