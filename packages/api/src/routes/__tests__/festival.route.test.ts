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
import festivalRoutes from "../festival.route";

describe("Festival Routes - Unit Tests", () => {
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
    app.route("/", festivalRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /festivals", () => {
    it("should list all festivals ordered by start_date descending", async () => {
      const mockFestivals = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          name: "Oktoberfest 2025",
          start_date: "2025-09-20",
          end_date: "2025-10-05",
          beer_cost: 1700, // €17.00
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2025",
          is_active: true,
          status: "upcoming",
          timezone: "Europe/Berlin",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          name: "Oktoberfest 2024",
          start_date: "2024-09-21",
          end_date: "2024-10-06",
          beer_cost: 1620, // €16.20
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2024",
          is_active: false,
          status: "ended",
          timezone: "Europe/Berlin",
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      // Mock list query (ordered by start_date desc)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestivals)),
      );

      const req = createAuthRequest("/festivals", {
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
            id: "123e4567-e89b-12d3-a456-426614174001",
            name: "Oktoberfest 2025",
            startDate: "2025-09-20",
            endDate: "2025-10-05",
            beerCost: 1700,
            location: "Munich, Germany",
            mapUrl: "https://wiesnmap.com/2025",
            isActive: true,
            status: "upcoming",
            timezone: "Europe/Berlin",
          }),
          expect.objectContaining({
            id: "123e4567-e89b-12d3-a456-426614174002",
            name: "Oktoberfest 2024",
            startDate: "2024-09-21",
            endDate: "2024-10-06",
            beerCost: 1620,
            location: "Munich, Germany",
            mapUrl: "https://wiesnmap.com/2024",
            isActive: false,
            status: "ended",
            timezone: "Europe/Berlin",
          }),
        ]),
      });
      expect(body.data).toHaveLength(2);

      // Verify repository called order by start_date desc
      expect(mockSupabase.from).toHaveBeenCalledWith("festivals");
    });

    it("should filter festivals by status", async () => {
      const mockFestivals = [
        {
          id: "123e4567-e89b-12d3-a456-426614174003",
          name: "Oktoberfest 2025",
          start_date: "2025-09-20",
          end_date: "2025-10-05",
          beer_cost: 1700,
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2025",
          is_active: true,
          status: "upcoming",
          timezone: "Europe/Berlin",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      // Mock filtered query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestivals)),
      );

      const req = createAuthRequest("/festivals?status=upcoming", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("upcoming");
    });

    it("should filter festivals by isActive flag", async () => {
      const mockFestivals = [
        {
          id: "123e4567-e89b-12d3-a456-426614174004",
          name: "Oktoberfest 2025",
          start_date: "2025-09-20",
          end_date: "2025-10-05",
          beer_cost: 1700,
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2025",
          is_active: true,
          status: "upcoming",
          timezone: "Europe/Berlin",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      // Mock filtered query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestivals)),
      );

      const req = createAuthRequest("/festivals?isActive=true", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].isActive).toBe(true);
    });

    it("should filter festivals by both status and isActive", async () => {
      const mockFestivals = [
        {
          id: "123e4567-e89b-12d3-a456-426614174005",
          name: "Oktoberfest 2024",
          start_date: "2024-09-21",
          end_date: "2024-10-06",
          beer_cost: 1620,
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2024",
          is_active: true,
          status: "active",
          timezone: "Europe/Berlin",
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      // Mock filtered query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestivals)),
      );

      const req = createAuthRequest("/festivals?status=active&isActive=true", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("active");
      expect(body.data[0].isActive).toBe(true);
    });

    it("should return empty array when no festivals found", async () => {
      // Mock empty result
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest("/festivals", {
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

    it("should handle database errors gracefully", async () => {
      // Mock database error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to list festivals", "PGRST000"),
        ),
      );

      const req = createAuthRequest("/festivals", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });

    it("should handle nullable fields correctly", async () => {
      const mockFestivals = [
        {
          id: "123e4567-e89b-12d3-a456-426614174006",
          name: "Local Festival",
          start_date: "2025-06-01",
          end_date: "2025-06-03",
          beer_cost: null, // Nullable
          location: null, // Nullable
          map_url: null, // Nullable
          is_active: false,
          status: "upcoming",
          timezone: null, // Nullable
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      // Mock query with nulls
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestivals)),
      );

      const req = createAuthRequest("/festivals", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0]).toMatchObject({
        beerCost: null,
        location: null,
        mapUrl: null,
        timezone: null,
      });
    });
  });

  describe("GET /festivals/:id", () => {
    it("should get festival by ID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174001";

      const mockFestival = {
        id: festivalId,
        name: "Oktoberfest 2024",
        start_date: "2024-09-21",
        end_date: "2024-10-06",
        beer_cost: 1620,
        location: "Munich, Germany",
        map_url: "https://wiesnmap.com/2024",
        is_active: true,
        status: "active",
        timezone: "Europe/Berlin",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
      };

      // Mock findById query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockFestival)),
      );

      const req = createAuthRequest(`/festivals/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toMatchObject({
        id: festivalId,
        name: "Oktoberfest 2024",
        startDate: "2024-09-21",
        endDate: "2024-10-06",
        beerCost: 1620,
        location: "Munich, Germany",
        mapUrl: "https://wiesnmap.com/2024",
        isActive: true,
        status: "active",
        timezone: "Europe/Berlin",
      });
    });

    it("should return 404 when festival not found", async () => {
      const festivalId = "923e4567-e89b-12d3-a456-426614174999";

      // Mock not found error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Not found", "PGRST116")),
      );

      const req = createAuthRequest(`/festivals/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toMatchObject({
        message: "Festival not found",
        code: "NOT_FOUND",
      });
    });

    it("should validate UUID format for festival ID", async () => {
      const req = createAuthRequest("/festivals/invalid-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174002";

      // Mock database error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Database error", "PGRST000")),
      );

      const req = createAuthRequest(`/festivals/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });

    it("should return festival with all status types", async () => {
      const statuses = ["upcoming", "active", "ended"] as const;

      for (const status of statuses) {
        const festivalId = `${status === "upcoming" ? "223e" : status === "active" ? "323e" : "423e"}4567-e89b-12d3-a456-426614174001`;

        const mockFestival = {
          id: festivalId,
          name: `Festival ${status}`,
          start_date: "2024-09-21",
          end_date: "2024-10-06",
          beer_cost: 1620,
          location: "Munich, Germany",
          map_url: "https://wiesnmap.com/2024",
          is_active: status === "active",
          status: status,
          timezone: "Europe/Berlin",
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        };

        vi.mocked(mockSupabase.from).mockReturnValueOnce(
          createMockChain(mockSupabaseSuccess(mockFestival)),
        );

        const req = createAuthRequest(`/festivals/${festivalId}`, {
          method: "GET",
        });

        const res = await app.request(req.url, {
          method: req.method,
          headers: req.headers,
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.status).toBe(status);
      }
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /festivals", async () => {
      const req = new Request("http://localhost/festivals", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /festivals/:id", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174001";
      const req = new Request(`http://localhost/festivals/${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });
});
