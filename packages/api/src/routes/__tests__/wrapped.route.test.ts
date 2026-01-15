import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import { NotFoundError } from "../../middleware/error";
import { WrappedService } from "../../services/wrapped.service";
import wrappedRoutes from "../wrapped.route";

// Mock the WrappedService
vi.mock("../../services/wrapped.service", () => ({
  WrappedService: vi.fn().mockImplementation(() => ({
    getWrapped: vi.fn(),
    generateWrapped: vi.fn(),
  })),
}));

describe("Wrapped Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockWrappedService: {
    getWrapped: ReturnType<typeof vi.fn>;
    generateWrapped: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Set up mock wrapped service instance
    mockWrappedService = {
      getWrapped: vi.fn(),
      generateWrapped: vi.fn(),
    };

    // Make the mocked constructor return our mock instance
    vi.mocked(WrappedService).mockImplementation(
      () => mockWrappedService as any,
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
    app.route("/", wrappedRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /wrapped/:festivalId", () => {
    it("should get cached wrapped data successfully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockWrappedData = {
        userId: mockUser.id,
        festivalId,
        totalDays: 5,
        totalBeers: 25,
        totalSpent: 405.0, // €16.20 * 25
        avgBeersPerDay: 5.0,
        favoriteTent: {
          id: "223e4567-e89b-12d3-a456-426614174001",
          name: "Hofbräu-Festzelt",
          visitCount: 3,
        },
        topDrinkType: "Helles",
        achievements: [
          {
            id: "323e4567-e89b-12d3-a456-426614174002",
            name: "First Beer",
            unlockedAt: "2024-09-21T14:00:00Z",
          },
          {
            id: "423e4567-e89b-12d3-a456-426614174003",
            name: "3-Day Streak",
            unlockedAt: "2024-09-23T16:00:00Z",
          },
        ],
        globalRank: 42,
        groupRanks: [
          {
            groupId: "523e4567-e89b-12d3-a456-426614174004",
            groupName: "Beer Buddies",
            rank: 2,
          },
        ],
        firstVisitDate: "2024-09-21",
        lastVisitDate: "2024-09-25",
        longestStreak: 3,
        generatedAt: new Date().toISOString(),
      };

      mockWrappedService.getWrapped.mockResolvedValueOnce({
        wrapped: mockWrappedData,
        cached: true,
      });

      const req = createAuthRequest(`/wrapped/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.wrapped).toBeDefined();
      expect(body.wrapped.userId).toBe(mockUser.id);
      expect(body.wrapped.totalDays).toBe(5);
      expect(body.wrapped.totalBeers).toBe(25);
      expect(body.cached).toBe(true);
      expect(mockWrappedService.getWrapped).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
      );
    });

    it("should return null when no wrapped data cached", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      mockWrappedService.getWrapped.mockResolvedValueOnce({
        wrapped: null,
        cached: false,
      });

      const req = createAuthRequest(`/wrapped/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.wrapped).toBeNull();
      expect(body.cached).toBe(false);
    });

    it("should validate festivalId is valid UUID", async () => {
      const req = createAuthRequest("/wrapped/invalid-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 when festival not found", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174999";

      mockWrappedService.getWrapped.mockRejectedValueOnce(
        new NotFoundError("Festival not found"),
      );

      const req = createAuthRequest(`/wrapped/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /wrapped/:festivalId/generate", () => {
    it("should generate wrapped data successfully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockWrappedData = {
        userId: mockUser.id,
        festivalId,
        totalDays: 7,
        totalBeers: 35,
        totalSpent: 567.0,
        avgBeersPerDay: 5.0,
        favoriteTent: {
          id: "223e4567-e89b-12d3-a456-426614174001",
          name: "Augustiner-Festhalle",
          visitCount: 4,
        },
        topDrinkType: "Oktoberfest Märzen",
        achievements: [
          {
            id: "323e4567-e89b-12d3-a456-426614174002",
            name: "First Beer",
            unlockedAt: "2024-09-21T14:00:00Z",
          },
          {
            id: "423e4567-e89b-12d3-a456-426614174003",
            name: "5-Day Streak",
            unlockedAt: "2024-09-25T16:00:00Z",
          },
          {
            id: "523e4567-e89b-12d3-a456-426614174004",
            name: "Tent Explorer",
            unlockedAt: "2024-09-26T12:00:00Z",
          },
        ],
        globalRank: 15,
        groupRanks: [
          {
            groupId: "623e4567-e89b-12d3-a456-426614174005",
            groupName: "Beer Buddies",
            rank: 1,
          },
          {
            groupId: "723e4567-e89b-12d3-a456-426614174006",
            groupName: "Work Friends",
            rank: 3,
          },
        ],
        firstVisitDate: "2024-09-21",
        lastVisitDate: "2024-09-30",
        longestStreak: 5,
        generatedAt: new Date().toISOString(),
      };

      mockWrappedService.generateWrapped.mockResolvedValueOnce({
        wrapped: mockWrappedData,
        regenerated: true,
      });

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.wrapped).toBeDefined();
      expect(body.wrapped.totalDays).toBe(7);
      expect(body.wrapped.totalBeers).toBe(35);
      expect(body.regenerated).toBe(true);
      expect(mockWrappedService.generateWrapped).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        false,
      );
    });

    it("should force regenerate when force=true", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockWrappedData = {
        userId: mockUser.id,
        festivalId,
        totalDays: 8,
        totalBeers: 40,
        totalSpent: 648.0,
        avgBeersPerDay: 5.0,
        favoriteTent: null,
        topDrinkType: null,
        achievements: [],
        globalRank: null,
        groupRanks: [],
        firstVisitDate: "2024-09-21",
        lastVisitDate: "2024-10-01",
        longestStreak: 5,
        generatedAt: new Date().toISOString(),
      };

      mockWrappedService.generateWrapped.mockResolvedValueOnce({
        wrapped: mockWrappedData,
        regenerated: true,
      });

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.regenerated).toBe(true);
      expect(mockWrappedService.generateWrapped).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        true,
      );
    });

    it("should return cached data when not forced", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockWrappedData = {
        userId: mockUser.id,
        festivalId,
        totalDays: 5,
        totalBeers: 25,
        totalSpent: 405.0,
        avgBeersPerDay: 5.0,
        favoriteTent: {
          id: "223e4567-e89b-12d3-a456-426614174001",
          name: "Hofbräu-Festzelt",
          visitCount: 3,
        },
        topDrinkType: "Helles",
        achievements: [],
        globalRank: 100,
        groupRanks: [],
        firstVisitDate: "2024-09-21",
        lastVisitDate: "2024-09-25",
        longestStreak: 3,
        generatedAt: new Date().toISOString(),
      };

      mockWrappedService.generateWrapped.mockResolvedValueOnce({
        wrapped: mockWrappedData,
        regenerated: false, // Returned from cache
      });

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.regenerated).toBe(false);
    });

    it("should use default force=false when not specified in body", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockWrappedData = {
        userId: mockUser.id,
        festivalId,
        totalDays: 5,
        totalBeers: 25,
        totalSpent: 405.0,
        avgBeersPerDay: 5.0,
        favoriteTent: null,
        topDrinkType: null,
        achievements: [],
        globalRank: null,
        groupRanks: [],
        firstVisitDate: "2024-09-21",
        lastVisitDate: "2024-09-25",
        longestStreak: 3,
        generatedAt: new Date().toISOString(),
      };

      mockWrappedService.generateWrapped.mockResolvedValueOnce({
        wrapped: mockWrappedData,
        regenerated: true,
      });

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // Empty object - force defaults to false
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      expect(mockWrappedService.generateWrapped).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        false, // Default value when force is not specified
      );
    });

    it("should validate festivalId is valid UUID", async () => {
      const req = createAuthRequest("/wrapped/invalid-uuid/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should return 404 when festival not found", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174999";

      mockWrappedService.generateWrapped.mockRejectedValueOnce(
        new NotFoundError("Festival not found"),
      );

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(404);
    });

    it("should return 404 when no data available for user", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      mockWrappedService.generateWrapped.mockRejectedValueOnce(
        new NotFoundError("No attendance data available for this festival"),
      );

      const req = createAuthRequest(`/wrapped/${festivalId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(404);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /wrapped/:festivalId", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(`http://localhost/wrapped/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /wrapped/:festivalId/generate", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/wrapped/${festivalId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force: false }),
        },
      );

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });
  });
});
