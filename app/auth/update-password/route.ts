import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);

    return NextResponse.redirect(new URL("/update-password", req.url));
  }

  console.error("ERROR: Invalid auth code or no auth code found");

  return NextResponse.redirect(new URL("/sign-in", req.url));
}
