import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createMockSupabase,
  mockSupabaseSuccess,
  mockSupabaseError,
  createMockChain,
} from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import tentRoutes from "../tent.route";

describe("Tent Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

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
    app.route("/", tentRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /tents", () => {
    it("should list tents for a festival", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockTents = [
        {
          festival_id: festivalId,
          tent_id: "tent1-4567-e89b-12d3-a456-426614174001",
          beer_price: 1650, // €16.50
          tents: {
            id: "tent1-4567-e89b-12d3-a456-426614174001",
            name: "Hofbräu-Festzelt",
            category: "large",
          },
        },
        {
          festival_id: festivalId,
          tent_id: "tent2-4567-e89b-12d3-a456-426614174002",
          beer_price: 1620, // €16.20
          tents: {
            id: "tent2-4567-e89b-12d3-a456-426614174002",
            name: "Schottenhamel",
            category: "large",
          },
        },
        {
          festival_id: festivalId,
          tent_id: "tent3-4567-e89b-12d3-a456-426614174003",
          beer_price: 1580, // €15.80
          tents: {
            id: "tent3-4567-e89b-12d3-a456-426614174003",
            name: "Augustiner-Festhalle",
            category: "large",
          },
        },
      ];

      // Mock tent list query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockTents)),
      );

      const req = createAuthRequest(`/tents?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            festivalId,
            tentId: "tent1-4567-e89b-12d3-a456-426614174001",
            beerPrice: 1650,
            tent: expect.objectContaining({
              id: "tent1-4567-e89b-12d3-a456-426614174001",
              name: "Hofbräu-Festzelt",
              category: "large",
            }),
          }),
          expect.objectContaining({
            festivalId,
            tentId: "tent2-4567-e89b-12d3-a456-426614174002",
            beerPrice: 1620,
            tent: expect.objectContaining({
              name: "Schottenhamel",
            }),
          }),
          expect.objectContaining({
            festivalId,
            tentId: "tent3-4567-e89b-12d3-a456-426614174003",
            beerPrice: 1580,
            tent: expect.objectContaining({
              name: "Augustiner-Festhalle",
            }),
          }),
        ]),
      });
      expect(body.data).toHaveLength(3);
    });

    it("should return empty array when no festivalId provided", async () => {
      const req = createAuthRequest("/tents", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ data: [] });

      // Should not call database when no festivalId
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should return empty array for festival with no tents", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock empty tent list
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(`/tents?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ data: [] });
    });

    it("should validate UUID format for festivalId", async () => {
      const req = createAuthRequest("/tents?festivalId=invalid-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock database error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Failed to list tents", "PGRST000")),
      );

      const req = createAuthRequest(`/tents?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });

    it("should sort tents alphabetically by name", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockTents = [
        {
          festival_id: festivalId,
          tent_id: "tent1-4567-e89b-12d3-a456-426614174001",
          beer_price: 1650,
          tents: {
            id: "tent1-4567-e89b-12d3-a456-426614174001",
            name: "Augustiner-Festhalle",
            category: "large",
          },
        },
        {
          festival_id: festivalId,
          tent_id: "tent2-4567-e89b-12d3-a456-426614174002",
          beer_price: 1620,
          tents: {
            id: "tent2-4567-e89b-12d3-a456-426614174002",
            name: "Hofbräu-Festzelt",
            category: "large",
          },
        },
        {
          festival_id: festivalId,
          tent_id: "tent3-4567-e89b-12d3-a456-426614174003",
          beer_price: 1580,
          tents: {
            id: "tent3-4567-e89b-12d3-a456-426614174003",
            name: "Schottenhamel",
            category: "large",
          },
        },
      ];

      // Mock tent list already sorted by name (ascending)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockTents)),
      );

      const req = createAuthRequest(`/tents?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      // Verify repository called order by name
      expect(mockSupabase.from).toHaveBeenCalledWith("festival_tents");

      // Verify data is in alphabetical order
      expect(body.data[0].tent.name).toBe("Augustiner-Festhalle");
      expect(body.data[1].tent.name).toBe("Hofbräu-Festzelt");
      expect(body.data[2].tent.name).toBe("Schottenhamel");
    });

    it("should include tent categories", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const mockTents = [
        {
          festival_id: festivalId,
          tent_id: "tent1-4567-e89b-12d3-a456-426614174001",
          beer_price: 1650,
          tents: {
            id: "tent1-4567-e89b-12d3-a456-426614174001",
            name: "Hofbräu-Festzelt",
            category: "large",
          },
        },
        {
          festival_id: festivalId,
          tent_id: "tent2-4567-e89b-12d3-a456-426614174002",
          beer_price: 1500,
          tents: {
            id: "tent2-4567-e89b-12d3-a456-426614174002",
            name: "Käfer's Wiesn-Schänke",
            category: "small",
          },
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockTents)),
      );

      const req = createAuthRequest(`/tents?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data[0].tent.category).toBe("large");
      expect(body.data[1].tent.category).toBe("small");
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /tents", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/tents?festivalId=${festivalId}`,
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
