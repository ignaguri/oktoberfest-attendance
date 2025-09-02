import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const publicPaths = [
    "/",
    "/auth",
    "/auth/confirm",
    "/auth/update-password",
    "/auth/callback",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/error",
    "/api/cron/scheduler",
    "/manifest.json",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/offline",
  ];

  if (request.nextUrl.search.startsWith("?redirectUrl=")) {
    const redirectUrl = request.nextUrl.search.split("redirectUrl=")[1];
    const unescapedUrl = decodeURIComponent(redirectUrl);
    return NextResponse.redirect(new URL(unescapedUrl, request.url));
  }

  if (publicPaths.includes(request.nextUrl.pathname)) {
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
