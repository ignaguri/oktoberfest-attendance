import { workflow } from "@novu/framework";
import { NOTIFICATION_PUSH_TYPES } from "@prostcounter/shared/constants";
import { z } from "zod";

export const FRIEND_REQUEST_WORKFLOW_ID = "friend-request" as const;

export const friendRequestPayloadSchema = z.object({
  senderName: z.string().describe("Name of the user sending the request"),
  senderAvatar: z.string().optional().describe("URL of the sender's avatar image"),
});

export type FriendRequestPayload = z.infer<typeof friendRequestPayloadSchema>;

export const friendRequestWorkflow = workflow(
  FRIEND_REQUEST_WORKFLOW_ID,
  async ({ step, payload }: { step: any; payload: FriendRequestPayload }) => {
    await step.inApp(
      "in-app-friend-request",
      async (controls: any) => {
        return {
          subject: controls.subject || `${payload.senderName} sent you a friend request`,
          body:
            controls.body ||
            `${payload.senderName} wants to be your friend! Tap to accept or decline.`,
          ...(payload.senderAvatar && { avatar: payload.senderAvatar }),
        };
      },
      {
        controlSchema: z.object({
          subject: z
            .string()
            .default("{{senderName}} sent you a friend request")
            .describe("Notification subject"),
          body: z
            .string()
            .default("{{senderName}} wants to be your friend! Tap to accept or decline.")
            .describe("Notification message"),
        }),
      },
    );

    await step.push(
      "push-friend-request",
      async (controls: any) => {
        return {
          subject: controls.pushSubject || "New friend request",
          body: controls.pushBody || `${payload.senderName} wants to be your friend!`,
          data: {
            type: NOTIFICATION_PUSH_TYPES.FRIEND_REQUEST,
          },
        };
      },
      {
        controlSchema: z.object({
          pushSubject: z.string().default("New friend request").describe("Push notification title"),
          pushBody: z
            .string()
            .default("{{senderName}} wants to be your friend!")
            .describe("Push notification message"),
        }),
      },
    );
  },
  {
    payloadSchema: friendRequestPayloadSchema,
    tags: ["friends", "social", "oktoberfest"],
  },
);
