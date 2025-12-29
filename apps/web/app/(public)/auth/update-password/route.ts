import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);

    return NextResponse.redirect(new URL("/update-password", req.url));
  }

  return NextResponse.redirect(new URL("/sign-in", req.url));
}
