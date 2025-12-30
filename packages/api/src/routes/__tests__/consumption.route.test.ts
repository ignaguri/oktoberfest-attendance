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
import consumptionRoutes from "../consumption.route";

describe("Consumption Routes - Unit Tests", () => {
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
    app.route("/", consumptionRoutes);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /consumption", () => {
    it("should log a new consumption and return updated attendance", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const tentId = "323e4567-e89b-12d3-a456-426614174001";

      // Mock attendance findOrCreate - return existing attendance
      const mockAttendance = {
        id: attendanceId,
        user_id: mockUser.id,
        festival_id: festivalId,
        date: "2024-09-21",
        created_at: "2024-09-21T10:00:00Z",
        updated_at: "2024-09-21T10:00:00Z",
        drink_count: 0,
        beer_count: 0,
        total_spent_cents: 0,
        total_tip_cents: 0,
        avg_price_cents: 0,
      };

      // findOrCreate query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAttendance)),
      );

      // Mock consumption create
      const mockConsumption = {
        id: "423e4567-e89b-12d3-a456-426614174001",
        attendance_id: attendanceId,
        tent_id: tentId,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1640,
        tip_cents: 20,
        volume_ml: 1000,
        recorded_at: "2024-09-21T14:30:00Z",
        created_at: "2024-09-21T14:30:00Z",
        updated_at: "2024-09-21T14:30:00Z",
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockConsumption)),
      );

      // Mock findById - return updated attendance with new totals
      const updatedAttendance = {
        ...mockAttendance,
        drink_count: 1,
        beer_count: 1,
        total_spent_cents: 1640,
        total_tip_cents: 20,
        avg_price_cents: 1640,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(updatedAttendance)),
      );

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-21",
          tentId,
          drinkType: "beer",
          basePriceCents: 1620,
          pricePaidCents: 1640,
          volumeMl: 1000,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(
        expect.objectContaining({
          id: attendanceId,
          userId: mockUser.id,
          festivalId,
          date: "2024-09-21",
          drinkCount: 1,
          beerCount: 1,
          totalSpentCents: 1640,
          totalTipCents: 20,
          avgPriceCents: 1640,
        }),
      );
    });

    it("should create new attendance when logging first consumption of the day", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174002";

      // Mock attendance findOrCreate - no existing, then create new
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Not found", "PGRST116")),
      );

      // Mock create new attendance
      const newAttendance = {
        id: attendanceId,
        user_id: mockUser.id,
        festival_id: festivalId,
        date: "2024-09-22",
        created_at: "2024-09-22T10:00:00Z",
        updated_at: "2024-09-22T10:00:00Z",
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(newAttendance)),
      );

      // Mock fetch created attendance with totals (initially 0)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            ...newAttendance,
            drink_count: 0,
            beer_count: 0,
            total_spent_cents: 0,
            total_tip_cents: 0,
            avg_price_cents: 0,
          }),
        ),
      );

      // Mock consumption create - first query for base price (since not provided in request)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            festival_id: festivalId,
            festivals: { beer_cost: 1620 },
          }),
        ),
      );

      // Mock consumption insert
      const mockConsumption = {
        id: "423e4567-e89b-12d3-a456-426614174002",
        attendance_id: attendanceId,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
        recorded_at: "2024-09-22T14:30:00Z",
        created_at: "2024-09-22T14:30:00Z",
        updated_at: "2024-09-22T14:30:00Z",
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockConsumption)),
      );

      // Mock findById after creating consumption - return updated attendance
      const updatedAttendance = {
        ...newAttendance,
        drink_count: 1,
        beer_count: 1,
        total_spent_cents: 1620,
        total_tip_cents: 0,
        avg_price_cents: 1620,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(updatedAttendance)),
      );

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-22",
          drinkType: "beer",
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(
        expect.objectContaining({
          id: attendanceId,
          date: "2024-09-22",
          drinkCount: 1,
          beerCount: 1,
        }),
      );
    });

    it("should support different drink types (radler, alcohol_free, soft_drink)", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      // Mock attendance findOrCreate
      const mockAttendance = {
        id: attendanceId,
        user_id: mockUser.id,
        festival_id: festivalId,
        date: "2024-09-21",
        created_at: "2024-09-21T10:00:00Z",
        updated_at: "2024-09-21T10:00:00Z",
        drink_count: 2,
        beer_count: 1,
        total_spent_cents: 3240,
        total_tip_cents: 40,
        avg_price_cents: 1620,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAttendance)),
      );

      // Mock consumption create for soft drink
      const mockConsumption = {
        id: "423e4567-e89b-12d3-a456-426614174003",
        attendance_id: attendanceId,
        drink_type: "soft_drink",
        drink_name: "Coca-Cola",
        base_price_cents: 500,
        price_paid_cents: 500,
        volume_ml: 500,
        recorded_at: "2024-09-21T15:00:00Z",
        created_at: "2024-09-21T15:00:00Z",
        updated_at: "2024-09-21T15:00:00Z",
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockConsumption)),
      );

      // Mock findById - beer_count stays same, drink_count increases
      const updatedAttendance = {
        ...mockAttendance,
        drink_count: 3,
        beer_count: 1, // Only beer/radler count as beer
        total_spent_cents: 3740,
        avg_price_cents: 1247,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(updatedAttendance)),
      );

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-21",
          drinkType: "soft_drink",
          drinkName: "Coca-Cola",
          basePriceCents: 500,
          pricePaidCents: 500,
          volumeMl: 500,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(
        expect.objectContaining({
          drinkCount: 3,
          beerCount: 1, // Beer count didn't increase
        }),
      );
    });

    it("should validate required fields (festivalId, date, pricePaidCents)", async () => {
      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Missing festivalId
          date: "2024-09-21",
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate date format (YYYY-MM-DD)", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "21-09-2024", // Invalid format
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400); // Bad request due to Zod validation
    });

    it("should validate UUID format for festivalId", async () => {
      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId: "invalid-uuid",
          date: "2024-09-21",
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors during consumption creation", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";

      // Mock attendance findOrCreate
      const mockAttendance = {
        id: attendanceId,
        user_id: mockUser.id,
        festival_id: festivalId,
        date: "2024-09-21",
        created_at: "2024-09-21T10:00:00Z",
        updated_at: "2024-09-21T10:00:00Z",
        drink_count: 0,
        beer_count: 0,
        total_spent_cents: 0,
        total_tip_cents: 0,
        avg_price_cents: 0,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAttendance)),
      );

      // Mock consumption create with error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to create consumption", "PGRST000"),
        ),
      );

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-21",
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(500);
    });

    it("should support optional fields (tentId, drinkName, recordedAt)", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const tentId = "323e4567-e89b-12d3-a456-426614174001";

      // Mock attendance findOrCreate
      const mockAttendance = {
        id: attendanceId,
        user_id: mockUser.id,
        festival_id: festivalId,
        date: "2024-09-21",
        created_at: "2024-09-21T10:00:00Z",
        updated_at: "2024-09-21T10:00:00Z",
        drink_count: 0,
        beer_count: 0,
        total_spent_cents: 0,
        total_tip_cents: 0,
        avg_price_cents: 0,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAttendance)),
      );

      // Mock consumption create with optional fields
      const mockConsumption = {
        id: "423e4567-e89b-12d3-a456-426614174004",
        attendance_id: attendanceId,
        tent_id: tentId,
        drink_type: "wine",
        drink_name: "Weißwein",
        base_price_cents: 900,
        price_paid_cents: 950,
        tip_cents: 50,
        volume_ml: 200,
        recorded_at: "2024-09-21T13:00:00Z",
        created_at: "2024-09-21T14:30:00Z",
        updated_at: "2024-09-21T14:30:00Z",
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockConsumption)),
      );

      // Mock findById
      const updatedAttendance = {
        ...mockAttendance,
        drink_count: 1,
        beer_count: 0,
        total_spent_cents: 950,
        total_tip_cents: 50,
        avg_price_cents: 950,
      };

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(updatedAttendance)),
      );

      const req = createAuthRequest("/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-21",
          tentId,
          drinkType: "wine",
          drinkName: "Weißwein",
          basePriceCents: 900,
          pricePaidCents: 950,
          volumeMl: 200,
          recordedAt: "2024-09-21T13:00:00Z",
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(
        expect.objectContaining({
          drinkCount: 1,
          beerCount: 0, // Wine doesn't count as beer
        }),
      );
    });
  });

  describe("Authentication", () => {
    it("should require authentication for POST /consumption", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request("http://localhost/consumption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          date: "2024-09-21",
          pricePaidCents: 1620,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(401);
    });
  });
});
