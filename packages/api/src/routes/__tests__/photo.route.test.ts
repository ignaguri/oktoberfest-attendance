import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import { NotFoundError } from "../../middleware/error";
import { PhotoService } from "../../services/photo.service";
import photoRoutes from "../photo.route";

// Mock the PhotoService
vi.mock("../../services/photo.service", () => ({
  PhotoService: vi.fn().mockImplementation(() => ({
    getUploadUrl: vi.fn(),
    confirmUpload: vi.fn(),
    listPhotos: vi.fn(),
    deletePhoto: vi.fn(),
  })),
}));

describe("Photo Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockPhotoService: {
    getUploadUrl: ReturnType<typeof vi.fn>;
    confirmUpload: ReturnType<typeof vi.fn>;
    listPhotos: ReturnType<typeof vi.fn>;
    deletePhoto: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Set up mock photo service instance
    mockPhotoService = {
      getUploadUrl: vi.fn(),
      confirmUpload: vi.fn(),
      listPhotos: vi.fn(),
      deletePhoto: vi.fn(),
    };

    // Make the mocked constructor return our mock instance
    vi.mocked(PhotoService).mockImplementation(() => mockPhotoService as any);

    // Mock auth middleware by setting context directly - MUST come before route mounting
    app.use("*", async (c, next) => {
      const authHeader = c.req.header("Authorization");

      // Routes without auth header should fail with 401
      if (!authHeader) {
        return c.json(
          { error: "Unauthorized", message: "Missing authorization header" },
          401,
        );
      }

      // Set mock user and supabase for authenticated requests
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    // Mount route after middleware
    app.route("/", photoRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /photos/upload-url", () => {
    it("should get upload URL successfully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const fileName = "beer_photo.jpg";
      const fileType = "image/jpeg";
      const fileSize = 1024 * 1024; // 1MB

      const mockResponse = {
        uploadUrl: "https://storage.example.com/upload/signed-url",
        publicUrl: "https://storage.example.com/public/beer_photo.jpg",
        expiresIn: 3600,
        pictureId: "323e4567-e89b-12d3-a456-426614174002",
      };

      mockPhotoService.getUploadUrl.mockResolvedValueOnce(mockResponse);

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=${fileName}&fileType=${fileType}&fileSize=${fileSize}`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual(mockResponse);
      expect(mockPhotoService.getUploadUrl).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          festivalId,
          attendanceId,
          fileName,
          fileType,
          fileSize,
        }),
      );
    });

    it("should accept different image types", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const fileSize = 1024 * 1024;

      const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

      for (const fileType of imageTypes) {
        const mockResponse = {
          uploadUrl: "https://storage.example.com/upload/signed-url",
          publicUrl: "https://storage.example.com/public/photo.jpg",
          expiresIn: 3600,
          pictureId: "323e4567-e89b-12d3-a456-426614174002",
        };

        mockPhotoService.getUploadUrl.mockResolvedValueOnce(mockResponse);

        const req = createAuthRequest(
          `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=photo.jpg&fileType=${encodeURIComponent(fileType)}&fileSize=${fileSize}`,
          {
            method: "GET",
          },
        );

        const res = await app.request(req.url, {
          method: req.method,
          headers: req.headers,
        });

        expect(res.status).toBe(200);
      }
    });

    it("should return 400 for invalid file type", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=doc.pdf&fileType=application/pdf&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when file size exceeds limit", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const fileSize = 11 * 1024 * 1024; // 11MB (max is 10MB)

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=large.jpg&fileType=image/jpeg&fileSize=${fileSize}`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is required", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?attendanceId=${attendanceId}&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate attendanceId is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate fileName is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate fileType is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=photo.jpg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate fileSize is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=photo.jpg&fileType=image/jpeg`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is valid UUID", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=invalid-uuid&attendanceId=${attendanceId}&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate attendanceId is valid UUID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=invalid-uuid&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 when attendance not found", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174999";

      mockPhotoService.getUploadUrl.mockRejectedValueOnce(
        new NotFoundError("Attendance not found"),
      );

      const req = createAuthRequest(
        `/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /photos/:id/confirm", () => {
    it("should confirm photo upload successfully", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174002";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      const mockPicture = {
        id: pictureId,
        attendanceId,
        userId: mockUser.id,
        pictureUrl: "https://storage.example.com/public/beer_photo.jpg",
        visibility: "public",
        createdAt: new Date().toISOString(),
      };

      mockPhotoService.confirmUpload.mockResolvedValueOnce(mockPicture);

      const req = createAuthRequest(`/photos/${pictureId}/confirm`, {
        method: "POST",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.picture.id).toBe(pictureId);
      expect(body.picture.url).toBe(mockPicture.pictureUrl);
      expect(body.picture.attendanceId).toBe(attendanceId);
      expect(mockPhotoService.confirmUpload).toHaveBeenCalledWith(
        pictureId,
        mockUser.id,
      );
    });

    it("should return 404 when photo not found", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174999";

      mockPhotoService.confirmUpload.mockRejectedValueOnce(
        new NotFoundError("Photo not found"),
      );

      const req = createAuthRequest(`/photos/${pictureId}/confirm`, {
        method: "POST",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(404);
    });

    it("should validate picture ID is valid UUID", async () => {
      const req = createAuthRequest("/photos/invalid-uuid/confirm", {
        method: "POST",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /photos", () => {
    it("should list user photos", async () => {
      const mockPhotos = [
        {
          id: "323e4567-e89b-12d3-a456-426614174002",
          attendanceId: "223e4567-e89b-12d3-a456-426614174001",
          userId: mockUser.id,
          pictureUrl: "https://storage.example.com/public/photo1.jpg",
          visibility: "public",
          createdAt: new Date().toISOString(),
        },
        {
          id: "423e4567-e89b-12d3-a456-426614174003",
          attendanceId: "223e4567-e89b-12d3-a456-426614174001",
          userId: mockUser.id,
          pictureUrl: "https://storage.example.com/public/photo2.jpg",
          visibility: "private",
          createdAt: new Date().toISOString(),
        },
      ];

      mockPhotoService.listPhotos.mockResolvedValueOnce({
        data: mockPhotos,
        total: 2,
      });

      const req = createAuthRequest("/photos", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.photos).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(50); // Default
      expect(body.offset).toBe(0); // Default
    });

    it("should filter by festival ID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      mockPhotoService.listPhotos.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const req = createAuthRequest(`/photos?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      expect(mockPhotoService.listPhotos).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        50,
        0,
      );
    });

    it("should support pagination", async () => {
      mockPhotoService.listPhotos.mockResolvedValueOnce({
        data: [],
        total: 100,
      });

      const req = createAuthRequest("/photos?limit=20&offset=40", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.limit).toBe(20);
      expect(body.offset).toBe(40);
      expect(mockPhotoService.listPhotos).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        20,
        40,
      );
    });

    it("should validate limit range", async () => {
      const req = createAuthRequest("/photos?limit=200", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Max limit is 100
    });

    it("should validate festivalId is valid UUID when provided", async () => {
      const req = createAuthRequest("/photos?festivalId=invalid-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return empty array when no photos found", async () => {
      mockPhotoService.listPhotos.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const req = createAuthRequest("/photos", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.photos).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe("DELETE /photos/:id", () => {
    it("should delete photo successfully", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174002";

      mockPhotoService.deletePhoto.mockResolvedValueOnce(undefined);

      const req = createAuthRequest(`/photos/${pictureId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(mockPhotoService.deletePhoto).toHaveBeenCalledWith(
        pictureId,
        mockUser.id,
      );
    });

    it("should return 404 when photo not found", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174999";

      mockPhotoService.deletePhoto.mockRejectedValueOnce(
        new NotFoundError("Photo not found"),
      );

      const req = createAuthRequest(`/photos/${pictureId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
    });

    it("should validate picture ID is valid UUID", async () => {
      const req = createAuthRequest("/photos/invalid-uuid", {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /photos/upload-url", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const req = new Request(
        `http://localhost/photos/upload-url?festivalId=${festivalId}&attendanceId=${attendanceId}&fileName=photo.jpg&fileType=image/jpeg&fileSize=1024`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /photos/:id/confirm", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174002";
      const req = new Request(`http://localhost/photos/${pictureId}/confirm`, {
        method: "POST",
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /photos", async () => {
      const req = new Request("http://localhost/photos", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for DELETE /photos/:id", async () => {
      const pictureId = "323e4567-e89b-12d3-a456-426614174002";
      const req = new Request(`http://localhost/photos/${pictureId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });
});
