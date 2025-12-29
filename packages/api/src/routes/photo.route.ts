import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetPhotoUploadUrlQuerySchema,
  GetPhotoUploadUrlResponseSchema,
  ConfirmPhotoUploadResponseSchema,
  GetPhotosQuerySchema,
  GetPhotosResponseSchema,
} from "@prostcounter/shared";
import { PhotoService } from "../services/photo.service";
import { SupabasePhotoRepository } from "../repositories/supabase";
import type { AuthContext } from "../middleware/auth";

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
      id: z.string().uuid("Invalid picture ID"),
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
    200
  );
});

// GET /photos - List user photos
const listPhotosRoute = createRoute({
  method: "get",
  path: "/photos",
  tags: ["photos"],
  summary: "List user photos",
  description: "Retrieves all beer pictures for the authenticated user with optional filters",
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
    query.offset
  );

  return c.json(
    {
      photos: result.data,
      total: result.total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    },
    200
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
      id: z.string().uuid("Invalid picture ID"),
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

export default app;
