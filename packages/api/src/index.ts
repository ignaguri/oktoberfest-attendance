import { OpenAPIHono } from "@hono/zod-openapi";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";

// Import routes
import consumptionRoute from "./routes/consumption.route";
import attendanceRoute from "./routes/attendance.route";
import festivalRoute from "./routes/festival.route";
import tentRoute from "./routes/tent.route";
import groupRoute from "./routes/group.route";
import leaderboardRoute from "./routes/leaderboard.route";
import achievementRoute from "./routes/achievement.route";

// Create the main Hono app with OpenAPI support
export const app = new OpenAPIHono();

// Register global error handler
app.onError(errorHandler);

// Health check endpoint (public)
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount API v1 routes with authentication
const apiV1 = new OpenAPIHono();

// Apply authentication middleware to all v1 routes
apiV1.use("*", authMiddleware);

// Mount route handlers
apiV1.route("/", consumptionRoute);
apiV1.route("/", attendanceRoute);
apiV1.route("/", festivalRoute);
apiV1.route("/", tentRoute);
apiV1.route("/", groupRoute);
apiV1.route("/", leaderboardRoute);
apiV1.route("/", achievementRoute);

// Mount v1 routes under /v1 prefix
app.route("/v1", apiV1);

// OpenAPI documentation endpoint
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "ProstCounter API",
    version: "0.1.0",
    description: "API for ProstCounter - Oktoberfest attendance tracking",
  },
  servers: [
    {
      url: "http://localhost:3008/api",
      description: "Local development",
    },
    {
      url: "https://prostcounter.vercel.app/api",
      description: "Production",
    },
  ],
});

export type App = typeof app;
