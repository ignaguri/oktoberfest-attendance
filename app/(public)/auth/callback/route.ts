import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");
  const error = searchParams.get("error");

  // Handle OAuth error from provider
  if (error) {
    console.error("OAuth provider error:", error);
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=oauth_failed&details=${encodeURIComponent(error)}`,
        req.url,
      ),
    );
  }

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("OAuth callback error:", exchangeError);
      return NextResponse.redirect(
        new URL(
          `/sign-in?error=oauth_failed&details=${encodeURIComponent(exchangeError.message)}`,
          req.url,
        ),
      );
    }
  }

  // Handle redirect parameter for OAuth flows
  const redirectUrl = redirect ? decodeURIComponent(redirect) : "/home";

  // Validate redirect URL to prevent open redirects
  const validRedirects = [
    "/home",
    "/profile",
    "/attendance",
    "/groups",
    "/leaderboard",
  ];

  // Only allow relative paths, and compare only the pathname
  let finalRedirect = "/home";
  try {
    // Prevent absolute URLs (e.g., //evil.com or http://evil.com)
    if (
      redirectUrl.startsWith("/") &&
      !redirectUrl.startsWith("//") &&
      !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(redirectUrl) // no scheme
    ) {
      // Use a dummy base to parse the path
      const parsed = new URL(redirectUrl, "http://localhost");
      if (validRedirects.includes(parsed.pathname)) {
        finalRedirect = parsed.pathname;
      }
    }
  } catch {
    // keep finalRedirect as is
  }

  return NextResponse.redirect(new URL(finalRedirect, req.url));
}
