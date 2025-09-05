import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(
        new URL("/sign-in?error=oauth_failed", req.url),
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
  const finalRedirect = validRedirects.includes(redirectUrl)
    ? redirectUrl
    : "/home";

  return NextResponse.redirect(new URL(finalRedirect, req.url));
}
