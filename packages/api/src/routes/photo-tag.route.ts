import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetTaggedPhotosQuerySchema,
  GetTaggedPhotosResponseSchema,
  PhotoTagsResponseSchema,
  SetPhotoTagsBodySchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { createPhotoTagService } from "../services/photo-tag.service";

const app = new OpenAPIHono<AuthContext>();

const PhotoIdParamSchema = z.object({
  photoId: z.uuid({ error: "Invalid photo ID" }),
});

const UserIdParamSchema = z.object({
  userId: z.uuid({ error: "Invalid user ID" }),
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

// ===== GET /photos/:photoId/tags =====
const getTagsRoute = createRoute({
  method: "get",
  path: "/photos/{photoId}/tags",
  tags: ["photo-tags"],
  summary: "List who is tagged in a photo",
  description: "Tagged people, whether the caller may edit them, and the photo's festival.",
  request: { params: PhotoIdParamSchema },
  responses: {
    200: {
      description: "Tags retrieved",
      content: { "application/json": { schema: PhotoTagsResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
    404: errorResponse("Photo not found"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getTagsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");

  const result = await createPhotoTagService(supabase).getTags(photoId, user.id);

  return c.json(result, 200);
});

// ===== PUT /photos/:photoId/tags =====
const setTagsRoute = createRoute({
  method: "put",
  path: "/photos/{photoId}/tags",
  tags: ["photo-tags"],
  summary: "Replace who is tagged in a photo",
  description:
    "Uploader only, public photos only, friends and group-mates of the photo's festival. Newly tagged people are notified.",
  request: {
    params: PhotoIdParamSchema,
    body: { content: { "application/json": { schema: SetPhotoTagsBodySchema } } },
  },
  responses: {
    200: {
      description: "Tags saved",
      content: { "application/json": { schema: PhotoTagsResponseSchema } },
    },
    400: errorResponse("Invalid tags"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Photo not found"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(setTagsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { photoId } = c.req.valid("param");
  const { userIds } = c.req.valid("json");

  const result = await createPhotoTagService(supabase).setTags(photoId, user.id, userIds);

  return c.json(result, 200);
});

// ===== GET /profiles/:userId/tagged-photos =====
const getTaggedPhotosRoute = createRoute({
  method: "get",
  path: "/profiles/{userId}/tagged-photos",
  tags: ["photo-tags"],
  summary: "Photos a user is tagged in",
  description: "Newest tag first, limited to photos the caller can see, for one festival.",
  request: { params: UserIdParamSchema, query: GetTaggedPhotosQuerySchema },
  responses: {
    200: {
      description: "Tagged photos retrieved",
      content: { "application/json": { schema: GetTaggedPhotosResponseSchema } },
    },
    400: errorResponse("Invalid request"),
    401: errorResponse("Unauthorized"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getTaggedPhotosRoute, async (c) => {
  const { user, supabase } = c.var;
  const { userId } = c.req.valid("param");
  const { festivalId } = c.req.valid("query");

  const result = await createPhotoTagService(supabase).getTaggedPhotos(user.id, userId, festivalId);

  return c.json(result, 200);
});

export default app;
