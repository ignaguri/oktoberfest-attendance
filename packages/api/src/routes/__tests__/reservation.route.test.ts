import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import { ValidationError, NotFoundError } from "../../middleware/error";
import { ReservationService } from "../../services/reservation.service";
import reservationRoutes from "../reservation.route";

// Mock the ReservationService
vi.mock("../../services/reservation.service", () => ({
  ReservationService: vi.fn().mockImplementation(() => ({
    createReservation: vi.fn(),
    checkin: vi.fn(),
    listReservations: vi.fn(),
    cancelReservation: vi.fn(),
  })),
}));

describe("Reservation Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockReservationService: {
    createReservation: ReturnType<typeof vi.fn>;
    checkin: ReturnType<typeof vi.fn>;
    listReservations: ReturnType<typeof vi.fn>;
    cancelReservation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Set up mock reservation service instance
    mockReservationService = {
      createReservation: vi.fn(),
      checkin: vi.fn(),
      listReservations: vi.fn(),
      cancelReservation: vi.fn(),
    };

    // Make the mocked constructor return our mock instance
    vi.mocked(ReservationService).mockImplementation(
      () => mockReservationService as any,
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
    app.route("/", reservationRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /reservations", () => {
    it("should create a reservation successfully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

      const mockReservation = {
        id: "323e4567-e89b-12d3-a456-426614174002",
        userId: mockUser.id,
        festivalId,
        tentId,
        tentName: "Hofbräu-Festzelt",
        startAt,
        endAt: null,
        status: "pending",
        note: "Birthday celebration",
        visibleToGroups: true,
        autoCheckin: false,
        reminderOffsetMinutes: 30,
        reminderSentAt: null,
        promptSentAt: null,
        processedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      mockReservationService.createReservation.mockResolvedValueOnce(
        mockReservation,
      );

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
          startAt,
          note: "Birthday celebration",
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ reservation: mockReservation });
      expect(mockReservationService.createReservation).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          festivalId,
          tentId,
          startAt,
          note: "Birthday celebration",
        }),
      );
    });

    it("should create reservation with all optional fields", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString();
      const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString(); // 2 hours later

      const mockReservation = {
        id: "323e4567-e89b-12d3-a456-426614174002",
        userId: mockUser.id,
        festivalId,
        tentId,
        startAt,
        endAt,
        status: "pending",
        note: "Group meeting",
        visibleToGroups: false,
        autoCheckin: true,
        reminderOffsetMinutes: 60,
        reminderSentAt: null,
        promptSentAt: null,
        processedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      mockReservationService.createReservation.mockResolvedValueOnce(
        mockReservation,
      );

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
          startAt,
          endAt,
          note: "Group meeting",
          visibleToGroups: false,
          autoCheckin: true,
          reminderOffsetMinutes: 60,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reservation.endAt).toBe(endAt);
      expect(body.reservation.visibleToGroups).toBe(false);
      expect(body.reservation.autoCheckin).toBe(true);
      expect(body.reservation.reminderOffsetMinutes).toBe(60);
    });

    it("should return 400 when reservation time is in the past", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() - 86400000).toISOString(); // Yesterday

      mockReservationService.createReservation.mockRejectedValueOnce(
        new ValidationError("Reservation start time must be in the future"),
      );

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
          startAt,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is required", async () => {
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tentId,
          startAt,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate tentId is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          startAt,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate startAt is required", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is valid UUID", async () => {
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId: "invalid-uuid",
          tentId,
          startAt,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate tentId is valid UUID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId: "invalid-uuid",
          startAt,
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate note max length", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
          startAt,
          note: "a".repeat(501), // Max is 500
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should validate reminderOffsetMinutes range", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const tentId = "223e4567-e89b-12d3-a456-426614174001";
      const startAt = new Date(Date.now() + 86400000).toISOString();

      const req = createAuthRequest("/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId,
          tentId,
          startAt,
          reminderOffsetMinutes: 1500, // Max is 1440 (24 hours)
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /reservations/:id/checkin", () => {
    it("should check in to a reservation successfully", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174002";

      const mockReservation = {
        id: reservationId,
        userId: mockUser.id,
        festivalId: "123e4567-e89b-12d3-a456-426614174000",
        tentId: "223e4567-e89b-12d3-a456-426614174001",
        startAt: new Date().toISOString(),
        endAt: null,
        status: "checked_in",
        note: null,
        visibleToGroups: true,
        autoCheckin: false,
        reminderOffsetMinutes: 30,
        reminderSentAt: null,
        promptSentAt: null,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockReservationService.checkin.mockResolvedValueOnce({
        reservation: mockReservation,
      });

      const req = createAuthRequest(`/reservations/${reservationId}/checkin`, {
        method: "POST",
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reservation.id).toBe(reservationId);
      expect(body.reservation.status).toBe("checked_in");
      expect(mockReservationService.checkin).toHaveBeenCalledWith(
        reservationId,
        mockUser.id,
      );
    });

    it("should check in and return attendance if auto_checkin enabled", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174002";
      const attendanceId = "423e4567-e89b-12d3-a456-426614174003";
      const today = new Date().toISOString().split("T")[0];

      const mockReservation = {
        id: reservationId,
        userId: mockUser.id,
        festivalId: "123e4567-e89b-12d3-a456-426614174000",
        tentId: "223e4567-e89b-12d3-a456-426614174001",
        startAt: new Date().toISOString(),
        status: "checked_in",
        autoCheckin: true,
        reminderOffsetMinutes: 30,
        visibleToGroups: true,
        endAt: null,
        note: null,
        reminderSentAt: null,
        promptSentAt: null,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockReservationService.checkin.mockResolvedValueOnce({
        reservation: mockReservation,
        attendance: { id: attendanceId, date: today },
      });

      const req = createAuthRequest(`/reservations/${reservationId}/checkin`, {
        method: "POST",
      });

      const res = await app.request(req);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reservation.autoCheckin).toBe(true);
      expect(body.attendance).toBeDefined();
      expect(body.attendance.id).toBe(attendanceId);
      expect(body.attendance.date).toBe(today);
    });

    it("should return 404 when reservation not found", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174999";

      mockReservationService.checkin.mockRejectedValueOnce(
        new NotFoundError("Reservation not found"),
      );

      const req = createAuthRequest(`/reservations/${reservationId}/checkin`, {
        method: "POST",
      });

      const res = await app.request(req);

      expect(res.status).toBe(404);
    });

    it("should validate reservation ID is valid UUID", async () => {
      const req = createAuthRequest("/reservations/invalid-uuid/checkin", {
        method: "POST",
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /reservations", () => {
    it("should list user reservations", async () => {
      const mockReservations = [
        {
          id: "323e4567-e89b-12d3-a456-426614174002",
          userId: mockUser.id,
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
          tentId: "223e4567-e89b-12d3-a456-426614174001",
          tentName: "Hofbräu-Festzelt",
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: null,
          status: "pending",
          note: null,
          visibleToGroups: true,
          autoCheckin: false,
          reminderOffsetMinutes: 30,
          reminderSentAt: null,
          promptSentAt: null,
          processedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
        {
          id: "423e4567-e89b-12d3-a456-426614174003",
          userId: mockUser.id,
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
          tentId: "523e4567-e89b-12d3-a456-426614174004",
          tentName: "Schottenhamel",
          startAt: new Date(Date.now() + 172800000).toISOString(), // 2 days later
          endAt: null,
          status: "confirmed",
          note: "Group reservation",
          visibleToGroups: true,
          autoCheckin: true,
          reminderOffsetMinutes: 60,
          reminderSentAt: null,
          promptSentAt: null,
          processedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        },
      ];

      mockReservationService.listReservations.mockResolvedValueOnce({
        data: mockReservations,
        total: 2,
      });

      const req = createAuthRequest("/reservations", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reservations).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(50); // Default
      expect(body.offset).toBe(0); // Default
    });

    it("should filter by festival ID", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      mockReservationService.listReservations.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const req = createAuthRequest(`/reservations?festivalId=${festivalId}`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      expect(mockReservationService.listReservations).toHaveBeenCalledWith(
        mockUser.id,
        festivalId,
        undefined,
        undefined,
        50,
        0,
      );
    });

    it("should filter by status", async () => {
      mockReservationService.listReservations.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const req = createAuthRequest("/reservations?status=pending", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      expect(mockReservationService.listReservations).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        "pending",
        undefined,
        50,
        0,
      );
    });

    it("should filter upcoming reservations", async () => {
      mockReservationService.listReservations.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const req = createAuthRequest("/reservations?upcoming=true", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      expect(mockReservationService.listReservations).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        undefined,
        true,
        50,
        0,
      );
    });

    it("should support pagination", async () => {
      mockReservationService.listReservations.mockResolvedValueOnce({
        data: [],
        total: 100,
      });

      const req = createAuthRequest("/reservations?limit=10&offset=20", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(20);
      expect(mockReservationService.listReservations).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        undefined,
        undefined,
        10,
        20,
      );
    });

    it("should validate status value", async () => {
      const req = createAuthRequest("/reservations?status=invalid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate limit range", async () => {
      const req = createAuthRequest("/reservations?limit=200", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Max limit is 100
    });

    it("should validate festivalId is valid UUID when provided", async () => {
      const req = createAuthRequest("/reservations?festivalId=invalid-uuid", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /reservations/:id", () => {
    it("should cancel a reservation successfully", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174002";

      const mockReservation = {
        id: reservationId,
        userId: mockUser.id,
        festivalId: "123e4567-e89b-12d3-a456-426614174000",
        tentId: "223e4567-e89b-12d3-a456-426614174001",
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: null,
        status: "cancelled",
        note: null,
        visibleToGroups: true,
        autoCheckin: false,
        reminderOffsetMinutes: 30,
        reminderSentAt: null,
        promptSentAt: null,
        processedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockReservationService.cancelReservation.mockResolvedValueOnce(
        mockReservation,
      );

      const req = createAuthRequest(`/reservations/${reservationId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reservation.id).toBe(reservationId);
      expect(body.reservation.status).toBe("cancelled");
      expect(mockReservationService.cancelReservation).toHaveBeenCalledWith(
        reservationId,
        mockUser.id,
      );
    });

    it("should return 404 when reservation not found", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174999";

      mockReservationService.cancelReservation.mockRejectedValueOnce(
        new NotFoundError("Reservation not found"),
      );

      const req = createAuthRequest(`/reservations/${reservationId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
    });

    it("should validate reservation ID is valid UUID", async () => {
      const req = createAuthRequest("/reservations/invalid-uuid", {
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
    it("should require authentication for POST /reservations", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
          tentId: "223e4567-e89b-12d3-a456-426614174001",
          startAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      });

      const res = await app.request(req);

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /reservations/:id/checkin", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174002";
      const req = new Request(
        `http://localhost/reservations/${reservationId}/checkin`,
        {
          method: "POST",
        },
      );

      const res = await app.request(req);

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /reservations", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for DELETE /reservations/:id", async () => {
      const reservationId = "323e4567-e89b-12d3-a456-426614174002";
      const req = new Request(
        `http://localhost/reservations/${reservationId}`,
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
  });
});
