import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import { ConflictError, NotFoundError } from "../../middleware/error";
import { LocationService } from "../../services/location.service";
import locationRoutes from "../location.route";

// Mock the LocationService
vi.mock("../../services/location.service", () => ({
  LocationService: vi.fn().mockImplementation(() => ({
    startSession: vi.fn(),
    stopSession: vi.fn(),
    updateLocation: vi.fn(),
    getNearbyMembers: vi.fn(),
  })),
}));

describe("Location Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockLocationService: {
    startSession: ReturnType<typeof vi.fn>;
    stopSession: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    getNearbyMembers: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Set up mock location service instance
    mockLocationService = {
      startSession: vi.fn(),
      stopSession: vi.fn(),
      updateLocation: vi.fn(),
      getNearbyMembers: vi.fn(),
    };

    // Make the mocked constructor return our mock instance
    vi.mocked(LocationService).mockImplementation(
      () => mockLocationService as any,
    );

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
    app.route("/", locationRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /location/sessions", () => {
    it("should start location sharing session", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const mockSession = {
        id: "session-e89b-12d3-a456-426614174001",
        userId: mockUser.id,
        festivalId,
        isActive: true,
        startedAt: "2024-09-21T14:00:00Z",
        expiresAt: "2024-09-21T16:00:00Z",
        createdAt: "2024-09-21T14:00:00Z",
        updatedAt: "2024-09-21T14:00:00Z",
      };

      mockLocationService.startSession.mockResolvedValueOnce(mockSession);

      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          durationMinutes: 120,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ session: mockSession });
      expect(mockLocationService.startSession).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          festivalId,
          durationMinutes: 120,
        }),
      );
    });

    it("should start session with initial location", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const mockSession = {
        id: "session-e89b-12d3-a456-426614174002",
        userId: mockUser.id,
        festivalId,
        isActive: true,
        startedAt: "2024-09-21T14:00:00Z",
        expiresAt: "2024-09-21T16:00:00Z",
        createdAt: "2024-09-21T14:00:00Z",
        updatedAt: "2024-09-21T14:00:00Z",
      };

      mockLocationService.startSession.mockResolvedValueOnce(mockSession);

      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          initialLocation: {
            latitude: 48.1351,
            longitude: 11.582,
            accuracy: 10,
            timestamp: "2024-09-21T14:00:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
    });

    it("should return 409 when user already has active session", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      mockLocationService.startSession.mockRejectedValueOnce(
        new ConflictError(
          "User already has an active location session for this festival",
        ),
      );

      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ festivalId }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(409);
    });

    it("should validate festivalId is required", async () => {
      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is valid UUID", async () => {
      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ festivalId: "invalid-uuid" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate durationMinutes is within range", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest("/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ festivalId, durationMinutes: 600 }), // Max is 480
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /location/sessions/:id", () => {
    it("should stop location sharing session", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";
      const mockSession = {
        id: sessionId,
        userId: mockUser.id,
        festivalId: "fest-id-12d3-a456-426614174000",
        isActive: false,
        startedAt: "2024-09-21T14:00:00Z",
        expiresAt: "2024-09-21T16:00:00Z",
        createdAt: "2024-09-21T14:00:00Z",
        updatedAt: "2024-09-21T15:00:00Z",
      };

      mockLocationService.stopSession.mockResolvedValueOnce(mockSession);

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true, session: mockSession });
      expect(mockLocationService.stopSession).toHaveBeenCalledWith(
        sessionId,
        mockUser.id,
      );
    });

    it("should return 404 when session not found", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174999";

      mockLocationService.stopSession.mockRejectedValueOnce(
        new NotFoundError("Session not found"),
      );

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
    });

    it("should validate session ID is valid UUID", async () => {
      const req = createAuthRequest("/location/sessions/invalid-uuid", {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /location/sessions/:id", () => {
    it("should update location for session", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";

      mockLocationService.updateLocation.mockResolvedValueOnce(undefined);

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId, // Schema requires this even though it's in the URL
          location: {
            latitude: 48.1351,
            longitude: 11.582,
            accuracy: 15,
            timestamp: "2024-09-21T14:30:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(mockLocationService.updateLocation).toHaveBeenCalledWith(
        sessionId,
        mockUser.id,
        expect.objectContaining({
          latitude: 48.1351,
          longitude: 11.582,
        }),
      );
    });

    it("should return 404 when session not found", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174999";

      mockLocationService.updateLocation.mockRejectedValueOnce(
        new NotFoundError("Session not found"),
      );

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId, // Schema requires this even though it's in the URL
          location: {
            latitude: 48.1351,
            longitude: 11.582,
            timestamp: "2024-09-21T14:30:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(404);
    });

    it("should validate session ID is valid UUID", async () => {
      const req = createAuthRequest("/location/sessions/invalid-uuid", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            latitude: 48.1351,
            longitude: 11.582,
            timestamp: "2024-09-21T14:30:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate latitude range", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            latitude: 100, // Invalid: must be -90 to 90
            longitude: 11.582,
            timestamp: "2024-09-21T14:30:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate longitude range", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            latitude: 48.1351,
            longitude: 200, // Invalid: must be -180 to 180
            timestamp: "2024-09-21T14:30:00Z",
          },
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate location object is required", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest(`/location/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }), // Missing location
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /location/nearby", () => {
    it("should get nearby group members", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const latitude = 48.1351;
      const longitude = 11.582;

      const mockMembers = [
        {
          sessionId: "session-1-12d3-a456-426614174001",
          userId: "user1-e89b-12d3-a456-426614174001",
          username: "beerfan",
          fullName: "Beer Fan",
          avatarUrl: "https://example.com/avatar1.jpg",
          groupId: "group-e89b-12d3-a456-426614174001",
          groupName: "Beer Buddies",
          lastLocation: {
            latitude: 48.1352,
            longitude: 11.5821,
            accuracy: 10,
            timestamp: "2024-09-21T14:30:00Z",
          },
          distance: 150,
        },
        {
          sessionId: "session-2-12d3-a456-426614174002",
          userId: "user2-e89b-12d3-a456-426614174002",
          username: "prosthund",
          fullName: "Prost Hund",
          avatarUrl: null,
          groupId: "group-e89b-12d3-a456-426614174001",
          groupName: "Beer Buddies",
          lastLocation: {
            latitude: 48.1355,
            longitude: 11.5825,
            accuracy: 15,
            timestamp: "2024-09-21T14:28:00Z",
          },
          distance: 450,
        },
      ];

      mockLocationService.getNearbyMembers.mockResolvedValueOnce(mockMembers);

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=${latitude}&longitude=${longitude}&radiusMeters=1000`,
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
      expect(body.members).toHaveLength(2);
      expect(body.userLocation).toMatchObject({
        latitude,
        longitude,
      });
      expect(body.radiusMeters).toBe(1000);
      expect(mockLocationService.getNearbyMembers).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        latitude,
        longitude,
        1000,
        undefined,
      );
    });

    it("should filter by group ID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const groupId = "923e4567-e89b-12d3-a456-426614174001"; // Valid UUID
      const latitude = 48.1351;
      const longitude = 11.582;

      mockLocationService.getNearbyMembers.mockResolvedValueOnce([]);

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=${latitude}&longitude=${longitude}&groupId=${groupId}`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      expect(mockLocationService.getNearbyMembers).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        latitude,
        longitude,
        1000, // Default radius
        groupId,
      );
    });

    it("should use default radius when not specified", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const latitude = 48.1351;
      const longitude = 11.582;

      mockLocationService.getNearbyMembers.mockResolvedValueOnce([]);

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=${latitude}&longitude=${longitude}`,
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
      expect(body.radiusMeters).toBe(1000); // Default
    });

    it("should validate festivalId is required", async () => {
      const req = createAuthRequest(
        "/location/nearby?latitude=48.1351&longitude=11.582",
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

    it("should validate latitude is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&longitude=11.582`,
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

    it("should validate longitude is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=48.1351`,
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

    it("should validate radiusMeters range", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=48.1351&longitude=11.582&radiusMeters=10000`, // Max is 5000
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

    it("should validate latitude range", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=100&longitude=11.582`, // Invalid latitude
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

    it("should validate groupId is valid UUID when provided", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest(
        `/location/nearby?festivalId=${festivalId}&latitude=48.1351&longitude=11.582&groupId=invalid-uuid`,
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
  });

  describe("Authentication", () => {
    it("should require authentication for POST /location/sessions", async () => {
      const req = new Request("http://localhost/location/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should require authentication for DELETE /location/sessions/:id", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";
      const req = new Request(
        `http://localhost/location/sessions/${sessionId}`,
        {
          method: "DELETE",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for PUT /location/sessions/:id", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174001";
      const req = new Request(
        `http://localhost/location/sessions/${sessionId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: {
              latitude: 48.1351,
              longitude: 11.582,
              timestamp: "2024-09-21T14:30:00Z",
            },
          }),
        },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /location/nearby", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/location/nearby?festivalId=${festivalId}&latitude=48.1351&longitude=11.582`,
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
  });
});
