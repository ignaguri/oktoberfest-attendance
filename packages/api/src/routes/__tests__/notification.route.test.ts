import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createTestApp,
  createMockUser,
  createAuthRequest,
} from "../../__tests__/helpers/test-server";
import { NotificationService } from "../../services/notification.service";
import notificationRoutes from "../notification.route";

// Mock the NotificationService
vi.mock("../../services/notification.service", () => ({
  NotificationService: vi.fn().mockImplementation(() => ({
    registerFCMToken: vi.fn(),
    subscribeUser: vi.fn(),
    getUserNotificationPreferences: vi.fn(),
    updateUserNotificationPreferences: vi.fn(),
  })),
}));

describe("Notification Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockNotificationService: {
    registerFCMToken: ReturnType<typeof vi.fn>;
    subscribeUser: ReturnType<typeof vi.fn>;
    getUserNotificationPreferences: ReturnType<typeof vi.fn>;
    updateUserNotificationPreferences: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Set up mock notification service instance
    mockNotificationService = {
      registerFCMToken: vi.fn(),
      subscribeUser: vi.fn(),
      getUserNotificationPreferences: vi.fn(),
      updateUserNotificationPreferences: vi.fn(),
    };

    // Make the mocked constructor return our mock instance
    vi.mocked(NotificationService).mockImplementation(
      () => mockNotificationService as any,
    );

    // Set NOVU_API_KEY for service initialization
    process.env.NOVU_API_KEY = "test-api-key";

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
    app.route("/", notificationRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NOVU_API_KEY;
  });

  describe("POST /notifications/token", () => {
    it("should register FCM token successfully", async () => {
      const fcmToken = "test-fcm-token-1234567890";
      mockNotificationService.registerFCMToken.mockResolvedValueOnce(true);

      const req = createAuthRequest("/notifications/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: fcmToken }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(mockNotificationService.registerFCMToken).toHaveBeenCalledWith(
        mockUser.id,
        fcmToken,
      );
    });

    it("should return success: false when registration fails", async () => {
      const fcmToken = "test-fcm-token-invalid";
      mockNotificationService.registerFCMToken.mockResolvedValueOnce(false);

      const req = createAuthRequest("/notifications/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: fcmToken }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: false });
    });

    it("should validate token is required", async () => {
      const req = createAuthRequest("/notifications/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate token is not empty", async () => {
      const req = createAuthRequest("/notifications/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });
  });

  describe("POST /notifications/subscribe", () => {
    it("should subscribe user with full profile data", async () => {
      mockNotificationService.subscribeUser.mockResolvedValueOnce(true);

      const subscribeData = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatar: "https://example.com/avatar.jpg",
      };

      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscribeData),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(mockNotificationService.subscribeUser).toHaveBeenCalledWith(
        mockUser.id,
        subscribeData.email,
        subscribeData.firstName,
        subscribeData.lastName,
        subscribeData.avatar,
      );
    });

    it("should subscribe user with minimal data (empty object)", async () => {
      mockNotificationService.subscribeUser.mockResolvedValueOnce(true);

      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(mockNotificationService.subscribeUser).toHaveBeenCalledWith(
        mockUser.id,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should subscribe user with only email", async () => {
      mockNotificationService.subscribeUser.mockResolvedValueOnce(true);

      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
    });

    it("should return success: false when subscription fails", async () => {
      mockNotificationService.subscribeUser.mockResolvedValueOnce(false);

      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: false });
    });

    it("should validate email format when provided", async () => {
      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "invalid-email" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });

    it("should validate avatar URL format when provided", async () => {
      const req = createAuthRequest("/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatar: "not-a-url" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });
  });

  describe("GET /notifications/preferences", () => {
    it("should get user notification preferences", async () => {
      const mockPreferences = {
        user_id: mockUser.id,
        push_enabled: true,
        group_join_enabled: true,
        checkin_enabled: true,
        reminders_enabled: false,
        achievement_notifications_enabled: true,
        group_notifications_enabled: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockNotificationService.getUserNotificationPreferences.mockResolvedValueOnce(
        mockPreferences,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({
        userId: mockUser.id,
        pushEnabled: true,
        groupJoinEnabled: true,
        checkinEnabled: true,
        remindersEnabled: false,
        achievementNotificationsEnabled: true,
        groupNotificationsEnabled: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });
    });

    it("should return null when no preferences found", async () => {
      mockNotificationService.getUserNotificationPreferences.mockResolvedValueOnce(
        null,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toBeNull();
    });

    it("should handle preferences with null fields", async () => {
      const mockPreferences = {
        user_id: mockUser.id,
        push_enabled: null,
        group_join_enabled: null,
        checkin_enabled: null,
        reminders_enabled: null,
        achievement_notifications_enabled: null,
        group_notifications_enabled: null,
        created_at: null,
        updated_at: null,
      };

      mockNotificationService.getUserNotificationPreferences.mockResolvedValueOnce(
        mockPreferences,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.pushEnabled).toBeNull();
      expect(body.groupJoinEnabled).toBeNull();
    });
  });

  describe("PUT /notifications/preferences", () => {
    it("should update all notification preferences", async () => {
      mockNotificationService.updateUserNotificationPreferences.mockResolvedValueOnce(
        true,
      );

      const updateData = {
        pushEnabled: true,
        groupJoinEnabled: false,
        checkinEnabled: true,
        remindersEnabled: false,
        achievementNotificationsEnabled: true,
        groupNotificationsEnabled: false,
      };

      const req = createAuthRequest("/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(
        mockNotificationService.updateUserNotificationPreferences,
      ).toHaveBeenCalledWith(mockUser.id, updateData);
    });

    it("should update single preference", async () => {
      mockNotificationService.updateUserNotificationPreferences.mockResolvedValueOnce(
        true,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pushEnabled: false }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
      expect(
        mockNotificationService.updateUserNotificationPreferences,
      ).toHaveBeenCalledWith(mockUser.id, { pushEnabled: false });
    });

    it("should allow empty update (no changes)", async () => {
      mockNotificationService.updateUserNotificationPreferences.mockResolvedValueOnce(
        true,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: true });
    });

    it("should return success: false when update fails", async () => {
      mockNotificationService.updateUserNotificationPreferences.mockResolvedValueOnce(
        false,
      );

      const req = createAuthRequest("/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pushEnabled: true }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ success: false });
    });

    it("should validate boolean types for preferences", async () => {
      const req = createAuthRequest("/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pushEnabled: "yes" }), // Invalid: should be boolean
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400); // Bad request
    });
  });

  describe("Authentication", () => {
    it("should require authentication for POST /notifications/token", async () => {
      const req = new Request("http://localhost/notifications/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "test-token" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /notifications/subscribe", async () => {
      const req = new Request("http://localhost/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /notifications/preferences", async () => {
      const req = new Request("http://localhost/notifications/preferences", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for PUT /notifications/preferences", async () => {
      const req = new Request("http://localhost/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pushEnabled: true }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });
  });
});
