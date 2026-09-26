import { ErrorCodes } from "@prostcounter/shared/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { NotFoundError, ValidationError } from "../../middleware/error";
import photoTagRoute from "../photo-tag.route";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { setTags: vi.fn(), getTags: vi.fn(), getTaggedPhotos: vi.fn() },
}));

vi.mock("../../services/photo-tag.service", () => ({
  createPhotoTagService: () => serviceMock,
}));

const PHOTO_ID = "123e4567-e89b-12d3-a456-426614174000";
const FRIEND_ID = "223e4567-e89b-12d3-a456-426614174000";
const FESTIVAL_ID = "323e4567-e89b-12d3-a456-426614174000";

describe("Photo tag routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockUser = createMockUser();
    const mockSupabase = createMockSupabase();

    app.use("*", async (c, next) => {
      if (!c.req.header("Authorization")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });
    app.route("/", photoTagRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PUT replaces the tag set for the caller", async () => {
    const response = { taggedUsers: [], canEdit: true, festivalId: FESTIVAL_ID };
    serviceMock.setTags.mockResolvedValueOnce(response);

    const res = await app.request(
      createAuthRequest(`/photos/${PHOTO_ID}/tags`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [FRIEND_ID] }),
      }) as Request,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(response);
    expect(serviceMock.setTags).toHaveBeenCalledWith(PHOTO_ID, mockUser.id, [FRIEND_ID]);
  });

  it("PUT rejects more than 10 people before reaching the service", async () => {
    const userIds = Array.from(
      { length: 11 },
      (_, index) => `${String(index).padStart(8, "0")}-e89b-12d3-a456-426614174000`,
    );

    const res = await app.request(
      createAuthRequest(`/photos/${PHOTO_ID}/tags`, {
        method: "PUT",
        body: JSON.stringify({ userIds }),
      }) as Request,
    );

    expect(res.status).toBe(400);
    expect(serviceMock.setTags).not.toHaveBeenCalled();
  });

  it("PUT rejects duplicate people", async () => {
    const res = await app.request(
      createAuthRequest(`/photos/${PHOTO_ID}/tags`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [FRIEND_ID, FRIEND_ID] }),
      }) as Request,
    );

    expect(res.status).toBe(400);
    expect(serviceMock.setTags).not.toHaveBeenCalled();
  });

  it("PUT surfaces service validation errors", async () => {
    serviceMock.setTags.mockRejectedValueOnce(
      new ValidationError(ErrorCodes.PHOTO_TAG_INVALID_USER),
    );

    const res = await app.request(
      createAuthRequest(`/photos/${PHOTO_ID}/tags`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [FRIEND_ID] }),
      }) as Request,
    );
    const json = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(json.error.code).toBe(ErrorCodes.PHOTO_TAG_INVALID_USER);
  });

  it("GET returns 404 for a photo the caller cannot see", async () => {
    serviceMock.getTags.mockRejectedValueOnce(new NotFoundError(ErrorCodes.PHOTO_NOT_FOUND));

    const res = await app.request(createAuthRequest(`/photos/${PHOTO_ID}/tags`) as Request);

    expect(res.status).toBe(404);
  });

  it("GET tagged-photos passes viewer, user and festival", async () => {
    serviceMock.getTaggedPhotos.mockResolvedValueOnce({ photos: [] });

    const res = await app.request(
      createAuthRequest(
        `/profiles/${FRIEND_ID}/tagged-photos?festivalId=${FESTIVAL_ID}`,
      ) as Request,
    );

    expect(res.status).toBe(200);
    expect(serviceMock.getTaggedPhotos).toHaveBeenCalledWith(mockUser.id, FRIEND_ID, FESTIVAL_ID);
  });

  it("GET tagged-photos requires a festival", async () => {
    const res = await app.request(
      createAuthRequest(`/profiles/${FRIEND_ID}/tagged-photos`) as Request,
    );

    expect(res.status).toBe(400);
  });
});
