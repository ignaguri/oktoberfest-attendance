import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  BulkUpdatePhotoVisibilitySchema,
  ConfirmPhotoUploadResponseSchema,
  GetPhotosQuerySchema,
  GetPhotosResponseSchema,
  GetPhotoUploadUrlQuerySchema,
  GetPhotoUploadUrlResponseSchema,
  GlobalPhotoSettingsSchema,
  GroupPhotoSettingsSchema,
  UpdateGlobalPhotoSettingsSchema,
  UpdatePhotoVisibilitySchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { SupabasePhotoRepository } from "../repositories/supabase";
import { PhotoService } from "../services/photo.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /photos/upload-url - Get signed upload URL
const getUploadUrlRoute = createRoute({
  method: "get",
  path: "/photos/upload-url",
  tags: ["photos"],
  summary: "Get signed upload URL for photo",
  description:
    "Returns a signed upload URL for uploading a beer picture. Validates file type, size, and attendance ownership.",
  request: {
    query: GetPhotoUploadUrlQuerySchema,
  },
  responses: {
    200: {
      description: "Upload URL generated successfully",
      content: {
        "application/json": {
          schema: GetPhotoUploadUrlResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Attendance not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getUploadUrlRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const result = await photoService.getUploadUrl(user.id, query);

  return c.json(result, 200);
});

// POST /photos/:id/confirm - Confirm photo upload
const confirmUploadRoute = createRoute({
  method: "post",
  path: "/photos/{id}/confirm",
  tags: ["photos"],
  summary: "Confirm photo upload",
  description:
    "Confirms that a photo was successfully uploaded to storage and marks it as confirmed in the database.",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid picture ID" }),
    }),
  },
  responses: {
    200: {
      description: "Photo confirmed successfully",
      content: {
        "application/json": {
          schema: ConfirmPhotoUploadResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Photo not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(confirmUploadRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const picture = await photoService.confirmUpload(id, user.id);

  return c.json(
    {
      success: true,
      picture: {
        id: picture.id,
        url: picture.pictureUrl,
        attendanceId: picture.attendanceId,
        uploadedAt: picture.createdAt,
      },
    },
    200,
  );
});

// GET /photos - List user photos
const listPhotosRoute = createRoute({
  method: "get",
  path: "/photos",
  tags: ["photos"],
  summary: "List user photos",
  description:
    "Retrieves all beer pictures for the authenticated user with optional filters",
  request: {
    query: GetPhotosQuerySchema,
  },
  responses: {
    200: {
      description: "Photos retrieved successfully",
      content: {
        "application/json": {
          schema: GetPhotosResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listPhotosRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const result = await photoService.listPhotos(
    user.id,
    query.festivalId,
    query.limit,
    query.offset,
  );

  return c.json(
    {
      photos: result.data,
      total: result.total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    },
    200,
  );
});

// DELETE /photos/:id - Delete photo
const deletePhotoRoute = createRoute({
  method: "delete",
  path: "/photos/{id}",
  tags: ["photos"],
  summary: "Delete a photo",
  description: "Deletes a beer picture from both storage and database",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid picture ID" }),
    }),
  },
  responses: {
    200: {
      description: "Photo deleted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Photo not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deletePhotoRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  await photoService.deletePhoto(id, user.id);

  return c.json({ success: true }, 200);
});

// ===== Photo Privacy Settings Routes =====

// GET /photos/settings/global - Get global photo settings
const getGlobalSettingsRoute = createRoute({
  method: "get",
  path: "/photos/settings/global",
  tags: ["photos"],
  summary: "Get global photo privacy settings",
  description: "Returns user's global photo visibility settings",
  responses: {
    200: {
      description: "Settings retrieved successfully",
      content: {
        "application/json": {
          schema: GlobalPhotoSettingsSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getGlobalSettingsRoute, async (c) => {
  const { user, supabase } = c.var;

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const settings = await photoService.getGlobalPhotoSettings(user.id);

  return c.json(settings, 200);
});

// PUT /photos/settings/global - Update global photo settings
const updateGlobalSettingsRoute = createRoute({
  method: "put",
  path: "/photos/settings/global",
  tags: ["photos"],
  summary: "Update global photo privacy settings",
  description: "Updates user's global photo visibility settings",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateGlobalPhotoSettingsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Settings updated successfully",
      content: {
        "application/json": {
          schema: GlobalPhotoSettingsSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateGlobalSettingsRoute, async (c) => {
  const { user, supabase } = c.var;
  const body = c.req.valid("json");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const settings = await photoService.updateGlobalPhotoSettings(
    user.id,
    body.hidePhotosFromAllGroups,
  );

  return c.json(settings, 200);
});

// GET /photos/settings/groups - Get all group photo settings
const getAllGroupSettingsRoute = createRoute({
  method: "get",
  path: "/photos/settings/groups",
  tags: ["photos"],
  summary: "Get all group photo privacy settings",
  description: "Returns user's photo visibility settings for all groups",
  responses: {
    200: {
      description: "Settings retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            settings: z.array(GroupPhotoSettingsSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getAllGroupSettingsRoute, async (c) => {
  const { user, supabase } = c.var;

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const settings = await photoService.getAllGroupPhotoSettings(user.id);

  return c.json({ settings }, 200);
});

// GET /photos/settings/groups/:groupId - Get group photo settings
const getGroupSettingsRoute = createRoute({
  method: "get",
  path: "/photos/settings/groups/{groupId}",
  tags: ["photos"],
  summary: "Get group photo privacy settings",
  description: "Returns user's photo visibility settings for a specific group",
  request: {
    params: z.object({
      groupId: z.uuid({ error: "Invalid group ID" }),
    }),
  },
  responses: {
    200: {
      description: "Settings retrieved successfully",
      content: {
        "application/json": {
          schema: GroupPhotoSettingsSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getGroupSettingsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { groupId } = c.req.valid("param");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const settings = await photoService.getGroupPhotoSettings(user.id, groupId);

  return c.json(settings, 200);
});

// PUT /photos/settings/groups/:groupId - Update group photo settings
const updateGroupSettingsRoute = createRoute({
  method: "put",
  path: "/photos/settings/groups/{groupId}",
  tags: ["photos"],
  summary: "Update group photo privacy settings",
  description: "Updates user's photo visibility settings for a specific group",
  request: {
    params: z.object({
      groupId: z.uuid({ error: "Invalid group ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            hidePhotosFromGroup: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Settings updated successfully",
      content: {
        "application/json": {
          schema: GroupPhotoSettingsSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateGroupSettingsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { groupId } = c.req.valid("param");
  const body = c.req.valid("json");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const settings = await photoService.updateGroupPhotoSettings(
    user.id,
    groupId,
    body.hidePhotosFromGroup,
  );

  return c.json(settings, 200);
});

// PUT /photos/:id/visibility - Update photo visibility
const updatePhotoVisibilityRoute = createRoute({
  method: "put",
  path: "/photos/{id}/visibility",
  tags: ["photos"],
  summary: "Update photo visibility",
  description: "Updates visibility setting for a specific photo",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid photo ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: UpdatePhotoVisibilitySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Visibility updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Photo not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updatePhotoVisibilityRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  await photoService.updatePhotoVisibility(user.id, id, body.visibility);

  return c.json({ success: true }, 200);
});

// PUT /photos/visibility - Bulk update photo visibility
const bulkUpdateVisibilityRoute = createRoute({
  method: "put",
  path: "/photos/visibility",
  tags: ["photos"],
  summary: "Bulk update photo visibility",
  description: "Updates visibility setting for multiple photos",
  request: {
    body: {
      content: {
        "application/json": {
          schema: BulkUpdatePhotoVisibilitySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Visibility updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            updatedCount: z.number(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    403: {
      description: "Forbidden - some photos don't belong to user",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(bulkUpdateVisibilityRoute, async (c) => {
  const { user, supabase } = c.var;
  const body = c.req.valid("json");

  const photoRepo = new SupabasePhotoRepository(supabase);
  const photoService = new PhotoService(photoRepo);

  const updatedCount = await photoService.bulkUpdatePhotoVisibility(
    user.id,
    body.photoIds,
    body.visibility,
  );

  return c.json({ success: true, updatedCount }, 200);
});

export default app;
