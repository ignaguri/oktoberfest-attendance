import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  GroupActionResponseSchema,
  GroupIdParamSchema,
  GroupInvitationIdParamSchema,
  InvitableUsersQuerySchema,
  InviteToGroupSchema,
  ListGroupInvitationsResponseSchema,
  ListInvitableUsersResponseSchema,
  ListSentGroupInvitationsResponseSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import { logger } from "../lib/logger";
import type { AuthContext } from "../middleware/auth";
import { SupabaseGroupInvitationRepository } from "../repositories/supabase";
import { evaluateAfterWrite } from "../services/evaluate-after-write";
import { GroupInvitationService } from "../services/group-invitation.service";
import { NotificationService } from "../services/notification.service";

// Registered before group.route.ts in index.ts: GET /groups/{id} there would
// otherwise match GET /groups/invitations/incoming and reject it as a bad uuid.
// Within this file the literal /groups/invitations/* routes are declared before
// the parameterized /groups/{id}/* ones for the same reason.
const app = new OpenAPIHono<AuthContext>();

const ErrorResponseSchema = ApiErrorSchema;

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

function service(supabase: AuthContext["Variables"]["supabase"]) {
  return new GroupInvitationService(new SupabaseGroupInvitationRepository(supabase));
}

// GET /groups/invitations/incoming - Invitations addressed to you
const incomingRoute = createRoute({
  method: "get",
  path: "/groups/invitations/incoming",
  tags: ["groups"],
  summary: "List group invitations addressed to you",
  responses: {
    200: {
      description: "Pending invitations",
      content: { "application/json": { schema: ListGroupInvitationsResponseSchema } },
    },
    401: errorResponses[401],
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(incomingRoute, async (c) => {
  const data = await service(c.var.supabase).listIncoming();
  return c.json({ data }, 200);
});

// POST /groups/invitations/{invitationId}/accept - Join the group
const acceptRoute = createRoute({
  method: "post",
  path: "/groups/invitations/{invitationId}/accept",
  tags: ["groups"],
  summary: "Accept a group invitation",
  request: { params: GroupInvitationIdParamSchema },
  responses: {
    200: {
      description: "Invitation accepted",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(acceptRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { invitationId } = c.req.valid("param");

  const accepted = await service(supabase).accept(invitationId);

  // The new member is the caller, so the request-scoped client is enough here.
  // Evaluate-only: the unlock reaches the client through the outbox, not this
  // response. Awaited so the outbox row exists before the client's next read.
  await evaluateAfterWrite(
    supabase,
    user.id,
    accepted.festivalId,
    "POST /groups/invitations/{invitationId}/accept",
  );

  notificationService(supabase)
    ?.notifyGroupInvitationAccepted({
      inviteeId: accepted.inviteeId,
      inviterId: accepted.inviterId,
      groupId: accepted.groupId,
    })
    .catch((err) => {
      logger.error({ err }, "[group-invitation] accepted notification failed");
    });

  return c.json({ success: true, message: "Invitation accepted" }, 200);
});

// POST /groups/invitations/{invitationId}/decline - Turn it down silently
const declineRoute = createRoute({
  method: "post",
  path: "/groups/invitations/{invitationId}/decline",
  tags: ["groups"],
  summary: "Decline a group invitation",
  description: "The group's creator is not notified.",
  request: { params: GroupInvitationIdParamSchema },
  responses: {
    200: {
      description: "Invitation declined",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(declineRoute, async (c) => {
  const { invitationId } = c.req.valid("param");
  await service(c.var.supabase).decline(invitationId);
  return c.json({ success: true, message: "Invitation declined" }, 200);
});

// DELETE /groups/invitations/{invitationId} - The creator withdraws it
const cancelRoute = createRoute({
  method: "delete",
  path: "/groups/invitations/{invitationId}",
  tags: ["groups"],
  summary: "Withdraw a group invitation you sent",
  request: { params: GroupInvitationIdParamSchema },
  responses: {
    200: {
      description: "Invitation withdrawn",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(cancelRoute, async (c) => {
  const { invitationId } = c.req.valid("param");
  await service(c.var.supabase).cancel(invitationId);
  return c.json({ success: true, message: "Invitation withdrawn" }, 200);
});

// GET /groups/{id}/invitable-users - Search people to invite
const invitableUsersRoute = createRoute({
  method: "get",
  path: "/groups/{id}/invitable-users",
  tags: ["groups"],
  summary: "Search people you could invite to a group",
  description: "Creator only. Each result carries where that person stands with this group.",
  request: { params: GroupIdParamSchema, query: InvitableUsersQuerySchema },
  responses: {
    200: {
      description: "Search results",
      content: { "application/json": { schema: ListInvitableUsersResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(invitableUsersRoute, async (c) => {
  const user = c.var.user;
  const { id } = c.req.valid("param");
  const { q } = c.req.valid("query");

  const data = await service(c.var.supabase).listInvitableUsers(user.id, id, q ?? "");

  return c.json({ data }, 200);
});

// POST /groups/{id}/invitations - Invite someone
const inviteRoute = createRoute({
  method: "post",
  path: "/groups/{id}/invitations",
  tags: ["groups"],
  summary: "Invite someone to a group",
  description: "Creator only. The invited person accepts or declines; they are not added directly.",
  request: {
    params: GroupIdParamSchema,
    body: { content: { "application/json": { schema: InviteToGroupSchema } } },
  },
  responses: {
    200: {
      description: "Invitation sent",
      content: { "application/json": { schema: GroupActionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(inviteRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const { inviteeId } = c.req.valid("json");

  await service(supabase).invite(id, inviteeId);

  notificationService(supabase)
    ?.notifyGroupInvitation({ inviterId: user.id, inviteeId, groupId: id })
    .catch((err) => {
      logger.error({ err }, "[group-invitation] notification failed");
    });

  return c.json({ success: true, message: "Invitation sent" }, 200);
});

// GET /groups/{id}/invitations - Pending invitations you sent for this group
const sentRoute = createRoute({
  method: "get",
  path: "/groups/{id}/invitations",
  tags: ["groups"],
  summary: "List pending invitations you sent for a group",
  description: "Creator only.",
  request: { params: GroupIdParamSchema },
  responses: {
    200: {
      description: "Pending invitations",
      content: { "application/json": { schema: ListSentGroupInvitationsResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(sentRoute, async (c) => {
  const user = c.var.user;
  const { id } = c.req.valid("param");
  const data = await service(c.var.supabase).listSent(id, user.id);
  return c.json({ data }, 200);
});

export default app;
