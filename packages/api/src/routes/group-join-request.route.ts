import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GroupActionResponseSchema,
  GroupIdParamSchema,
  GroupJoinRequestIdParamSchema,
  ListGroupJoinRequestsResponseSchema,
} from "@prostcounter/shared";

import { logger } from "../lib/logger";
import type { AuthContext } from "../middleware/auth";
import { SupabaseGroupJoinRequestRepository } from "../repositories/supabase";
import { evaluateAfterWrite } from "../services/evaluate-after-write";
import { GroupJoinRequestService } from "../services/group-join-request.service";
import { NotificationService } from "../services/notification.service";
import { createAdminClient } from "../utils/admin-client";

// Registered before group.route.ts in index.ts: GET /groups/{id} there would
// otherwise match GET /groups/join-requests/incoming and reject it as a bad uuid.
const app = new OpenAPIHono<AuthContext>();

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

const errorResponses = {
  401: {
    description: "Unauthorized",
    content: { "application/json": { schema: ErrorResponseSchema } },
  },
  403: {
    description: "Forbidden",
    content: { "application/json": { schema: ErrorResponseSchema } },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: ErrorResponseSchema } },
  },
  409: {
    description: "Conflict",
    content: { "application/json": { schema: ErrorResponseSchema } },
  },
} as const;

function notificationService(supabase: AuthContext["Variables"]["supabase"]) {
  const novuApiKey = process.env.NOVU_API_KEY;
  return novuApiKey ? new NotificationService(supabase, novuApiKey) : null;
}

// POST /groups/{id}/join-requests - Ask to join a group
const requestRoute = createRoute({
  method: "post",
  path: "/groups/{id}/join-requests",
  tags: ["groups"],
  summary: "Request to join a group",
  description: "Sends a join request to the group's creator. Invite links still join instantly.",
  request: { params: GroupIdParamSchema },
  responses: {
    200: {
      description: "Request sent",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(requestRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const service = new GroupJoinRequestService(new SupabaseGroupJoinRequestRepository(supabase));
  const result = await service.request(id);

  if (result.notifyCreator) {
    notificationService(supabase)
      ?.notifyJoinRequest({ requesterId: user.id, groupId: id })
      .catch((err) => {
        logger.error({ err }, "[group-join-request] notification failed");
      });
  }

  return c.json({ success: true, message: "Join request sent" }, 200);
});

// DELETE /groups/{id}/join-requests/mine - Withdraw your own pending request
const cancelRoute = createRoute({
  method: "delete",
  path: "/groups/{id}/join-requests/mine",
  tags: ["groups"],
  summary: "Cancel your join request",
  request: { params: GroupIdParamSchema },
  responses: {
    200: {
      description: "Request cancelled",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(cancelRoute, async (c) => {
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const service = new GroupJoinRequestService(new SupabaseGroupJoinRequestRepository(supabase));
  await service.cancel(id);

  return c.json({ success: true, message: "Join request cancelled" }, 200);
});

// GET /groups/join-requests/incoming - Pending requests on groups you created
const incomingRoute = createRoute({
  method: "get",
  path: "/groups/join-requests/incoming",
  tags: ["groups"],
  summary: "List pending join requests for your groups",
  responses: {
    200: {
      description: "Pending join requests",
      content: { "application/json": { schema: ListGroupJoinRequestsResponseSchema } },
    },
    401: errorResponses[401],
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(incomingRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;

  const service = new GroupJoinRequestService(new SupabaseGroupJoinRequestRepository(supabase));
  const data = await service.listIncoming(user.id);

  return c.json({ data }, 200);
});

// POST /groups/join-requests/{requestId}/accept - Let the requester in
const acceptRoute = createRoute({
  method: "post",
  path: "/groups/join-requests/{requestId}/accept",
  tags: ["groups"],
  summary: "Accept a join request",
  request: { params: GroupJoinRequestIdParamSchema },
  responses: {
    200: {
      description: "Request accepted",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(acceptRoute, async (c) => {
  const supabase = c.var.supabase;
  const { requestId } = c.req.valid("param");

  const service = new GroupJoinRequestService(new SupabaseGroupJoinRequestRepository(supabase));
  const accepted = await service.accept(requestId);

  // The new member is the requester, not the caller, so evaluate their
  // achievements with the service-role client. Awaited so the outbox row exists
  // before the requester's next read; never fails the accept.
  try {
    await evaluateAfterWrite(
      createAdminClient(),
      accepted.requesterId,
      accepted.festivalId,
      "POST /groups/join-requests/{requestId}/accept",
    );
  } catch (err) {
    logger.error({ err }, "[group-join-request] achievement evaluation skipped");
  }

  notificationService(supabase)
    ?.notifyJoinRequestAccepted({ requesterId: accepted.requesterId, groupId: accepted.groupId })
    .catch((err) => {
      logger.error({ err }, "[group-join-request] accepted notification failed");
    });

  return c.json({ success: true, message: "Join request accepted" }, 200);
});

// POST /groups/join-requests/{requestId}/decline - Decline silently
const declineRoute = createRoute({
  method: "post",
  path: "/groups/join-requests/{requestId}/decline",
  tags: ["groups"],
  summary: "Decline a join request",
  description: "The requester is not notified.",
  request: { params: GroupJoinRequestIdParamSchema },
  responses: {
    200: {
      description: "Request declined",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(declineRoute, async (c) => {
  const supabase = c.var.supabase;
  const { requestId } = c.req.valid("param");

  const service = new GroupJoinRequestService(new SupabaseGroupJoinRequestRepository(supabase));
  await service.decline(requestId);

  return c.json({ success: true, message: "Join request declined" }, 200);
});

export default app;
