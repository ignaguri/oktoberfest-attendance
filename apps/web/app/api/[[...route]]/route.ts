import { app } from "@prostcounter/api";

// Export runtime configuration
export const runtime = "nodejs";

/**
 * Handler that strips /api prefix before passing requests to Hono
 *
 * Next.js mounts this at /api/[[...route]], so requests come in as /api/v1/groups
 * But Hono routes are configured for /v1/groups, so we strip the /api prefix
 */
async function handler(req: Request) {
  // Strip /api prefix from the URL since Hono routes expect /v1/...
  const url = new URL(req.url);
  const pathWithoutApi = url.pathname.replace(/^\/api/, "");
  const newUrl = new URL(pathWithoutApi + url.search, url.origin);

  // Create new request with modified URL
  const modifiedRequest = new Request(newUrl, req);

  // Pass to Hono app
  return app.fetch(modifiedRequest);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;
