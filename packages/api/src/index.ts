import { OpenAPIHono } from "@hono/zod-openapi";
import { errorHandler } from "./middleware/error";

// Create the main Hono app with OpenAPI support
export const app = new OpenAPIHono();

// Register global error handler
app.onError(errorHandler);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

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
