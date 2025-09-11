import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Block .php file requests with 500 error to prevent automated scanning
  if (request.nextUrl.pathname.endsWith(".php")) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  // Block other common attack patterns
  const suspiciousPatterns = [
    ".asp",
    ".aspx",
    ".jsp",
    ".cgi",
    ".pl",
    ".py",
    ".sh",
    ".bat",
    ".cmd",
    "wp-admin",
    "wp-login",
    "admin.php",
    "config.php",
    "phpmyadmin",
    "xmlrpc.php",
    "wp-json",
    "wp-content",
    "wp-includes",
  ];

  const pathname = request.nextUrl.pathname.toLowerCase();
  if (suspiciousPatterns.some((pattern) => pathname.includes(pattern))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const publicPaths = [
    "/",
    "/auth",
    "/auth/confirm",
    "/auth/update-password",
    "/auth/callback",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/privacy",
    "/error",
    "/api/cron/scheduler",
    "/api/novu",
    "/manifest.json",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/offline",
    "/r",
  ];

  if (request.nextUrl.search.startsWith("?redirectUrl=")) {
    const redirectUrl = request.nextUrl.search.split("redirectUrl=")[1];
    const unescapedUrl = decodeURIComponent(redirectUrl);
    return NextResponse.redirect(new URL(unescapedUrl, request.url));
  }

  // Handle OAuth code parameter at root level as fallback
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const code = request.nextUrl.searchParams.get("code");
    const redirectParam = request.nextUrl.searchParams.get("redirect");

    // Construct the callback URL with the code
    const callbackUrl = new URL("/auth/callback", request.url);
    if (code) callbackUrl.searchParams.set("code", code);
    if (redirectParam) callbackUrl.searchParams.set("redirect", redirectParam);

    return NextResponse.redirect(callbackUrl);
  }

  if (
    publicPaths.includes(request.nextUrl.pathname) ||
    request.nextUrl.pathname.startsWith("/r/")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     * - sitemap.xml (sitemap file)
     * - manifest.json (web app manifest file)
     * - manifest.webmanifest (web app manifest file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
