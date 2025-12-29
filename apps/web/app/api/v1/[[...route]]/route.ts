import { app } from "@prostcounter/api";
import { handle } from "hono/vercel";

// Export runtime configuration
export const runtime = "nodejs";

// Mount Hono app handlers for all HTTP methods
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
