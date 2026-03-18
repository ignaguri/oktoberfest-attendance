import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  FriendActionResponseSchema,
  FriendRequestCountResponseSchema,
  FriendRequestIdParamSchema,
  FriendSearchQuerySchema,
  FriendshipStatusCheckSchema,
  FriendUserIdParamSchema,
  ListFriendRequestsResponseSchema,
  ListFriendsResponseSchema,
  ListFriendSuggestionsResponseSchema,
  SearchUsersResponseSchema,
  SendFriendRequestSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { SupabaseFriendRepository } from "../repositories/supabase";
import { FriendService } from "../services/friend.service";
import { NotificationService } from "../services/notification.service";

const app = new OpenAPIHono<AuthContext>();

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// GET /friends - List accepted friends
const listFriendsRoute = createRoute({
  method: "get",
  path: "/friends",
  tags: ["friends"],
  summary: "List accepted friends",
  responses: {
    200: {
      description: "Friends list",
      content: { "application/json": { schema: ListFriendsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listFriendsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const data = await service.listFriends(user.id);
  return c.json({ data }, 200);
});

// GET /friends/requests/incoming - Pending incoming requests
const incomingRequestsRoute = createRoute({
  method: "get",
  path: "/friends/requests/incoming",
  tags: ["friends"],
  summary: "Get incoming friend requests",
  responses: {
    200: {
      description: "Incoming requests",
      content: {
        "application/json": { schema: ListFriendRequestsResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(incomingRequestsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const data = await service.getIncomingRequests(user.id);
  return c.json({ data }, 200);
});

// GET /friends/requests/outgoing - Pending outgoing requests
const outgoingRequestsRoute = createRoute({
  method: "get",
  path: "/friends/requests/outgoing",
  tags: ["friends"],
  summary: "Get outgoing friend requests",
  responses: {
    200: {
      description: "Outgoing requests",
      content: {
        "application/json": { schema: ListFriendRequestsResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(outgoingRequestsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const data = await service.getOutgoingRequests(user.id);
  return c.json({ data }, 200);
});

// GET /friends/requests/count - Count of pending incoming requests (for badge)
const requestCountRoute = createRoute({
  method: "get",
  path: "/friends/requests/count",
  tags: ["friends"],
  summary: "Get count of pending incoming friend requests",
  responses: {
    200: {
      description: "Request count",
      content: {
        "application/json": { schema: FriendRequestCountResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(requestCountRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const count = await service.getIncomingRequestCount(user.id);
  return c.json({ count }, 200);
});

// POST /friends/request - Send friend request
const sendRequestRoute = createRoute({
  method: "post",
  path: "/friends/request",
  tags: ["friends"],
  summary: "Send a friend request",
  request: {
    body: {
      content: {
        "application/json": { schema: SendFriendRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Request sent",
      content: {
        "application/json": { schema: FriendActionResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Conflict",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(sendRequestRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { addresseeId } = c.req.valid("json");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const result = await service.sendRequest(user.id, addresseeId);

  // Send push notification to the addressee (fire-and-forget)
  const novuApiKey = process.env.NOVU_API_KEY;
  if (novuApiKey) {
    const notificationService = new NotificationService(supabase, novuApiKey);
    notificationService
      .notifyFriendRequest(user.id, addresseeId)
      .catch(() => {});
  }

  return c.json(result, 200);
});

// POST /friends/request/:id/accept - Accept friend request
const acceptRequestRoute = createRoute({
  method: "post",
  path: "/friends/request/{id}/accept",
  tags: ["friends"],
  summary: "Accept a friend request",
  request: {
    params: FriendRequestIdParamSchema,
  },
  responses: {
    200: {
      description: "Request accepted",
      content: {
        "application/json": { schema: FriendActionResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(acceptRequestRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const result = await service.acceptRequest(id, user.id);
  return c.json({ success: result.success, message: result.message }, 200);
});

// POST /friends/request/:id/decline - Decline friend request
const declineRequestRoute = createRoute({
  method: "post",
  path: "/friends/request/{id}/decline",
  tags: ["friends"],
  summary: "Decline a friend request",
  request: {
    params: FriendRequestIdParamSchema,
  },
  responses: {
    200: {
      description: "Request declined",
      content: {
        "application/json": { schema: FriendActionResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(declineRequestRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const result = await service.declineRequest(id, user.id);
  return c.json({ success: result.success, message: result.message }, 200);
});

// DELETE /friends/request/:id - Cancel outgoing request
const cancelRequestRoute = createRoute({
  method: "delete",
  path: "/friends/request/{id}",
  tags: ["friends"],
  summary: "Cancel an outgoing friend request",
  request: {
    params: FriendRequestIdParamSchema,
  },
  responses: {
    200: {
      description: "Request cancelled",
      content: {
        "application/json": { schema: FriendActionResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(cancelRequestRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  await service.cancelRequest(id, user.id);
  return c.json({ success: true, message: "Friend request cancelled" }, 200);
});

// DELETE /friends/:userId - Unfriend
const unfriendRoute = createRoute({
  method: "delete",
  path: "/friends/{userId}",
  tags: ["friends"],
  summary: "Unfriend a user",
  request: {
    params: FriendUserIdParamSchema,
  },
  responses: {
    200: {
      description: "Unfriended",
      content: {
        "application/json": { schema: FriendActionResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(unfriendRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { userId } = c.req.valid("param");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  await service.unfriend(user.id, userId);
  return c.json({ success: true, message: "Unfriended successfully" }, 200);
});

// GET /friends/suggestions - People you may know
const suggestionsRoute = createRoute({
  method: "get",
  path: "/friends/suggestions",
  tags: ["friends"],
  summary: "Get friend suggestions from shared groups",
  responses: {
    200: {
      description: "Suggestions",
      content: {
        "application/json": { schema: ListFriendSuggestionsResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(suggestionsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const data = await service.getSuggestions(user.id);
  return c.json({ data }, 200);
});

// GET /friends/search - Search users by username
const searchUsersRoute = createRoute({
  method: "get",
  path: "/friends/search",
  tags: ["friends"],
  summary: "Search users by username or name",
  request: {
    query: FriendSearchQuerySchema,
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": { schema: SearchUsersResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(searchUsersRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { q } = c.req.valid("query");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const data = await service.searchUsers(user.id, q);
  return c.json({ data }, 200);
});

// GET /friends/status/:userId - Get friendship status with a specific user
const friendshipStatusRoute = createRoute({
  method: "get",
  path: "/friends/status/{userId}",
  tags: ["friends"],
  summary: "Get friendship status with a user",
  request: {
    params: FriendUserIdParamSchema,
  },
  responses: {
    200: {
      description: "Friendship status",
      content: {
        "application/json": { schema: FriendshipStatusCheckSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(friendshipStatusRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { userId } = c.req.valid("param");
  const repo = new SupabaseFriendRepository(supabase);
  const service = new FriendService(repo);
  const status = await service.getFriendshipStatus(user.id, userId);
  return c.json(status, 200);
});

export default app;
