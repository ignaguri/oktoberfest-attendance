import { logger } from "@/lib/logger";
import { reportApiException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import { joinGroupWithToken } from "./actions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  try {
    const groupId = await joinGroupWithToken({ token });
    if (groupId) {
      // Get group name for the success page
      const supabase = createClient();
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      const redirectUrl = new URL(
        `/join-group/success`,
        request.nextUrl.origin,
      );
      redirectUrl.searchParams.set("group", group?.name || "Group");
      redirectUrl.searchParams.set("group_id", groupId);

      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    const err = error as Error & {
      code?: string;
      groupName?: string;
      expiredAt?: string;
    };

    reportApiException("join-group", err);
    logger.error(
      "Failed to join group with token",
      logger.apiRoute("join-group", { token }),
      err,
    );

    // Handle specific error types
    if (err.code === "TOKEN_EXPIRED") {
      const errorUrl = new URL(`/join-group/error`, request.nextUrl.origin);
      errorUrl.searchParams.set("type", "expired");
      errorUrl.searchParams.set("group", err.groupName || "Unknown Group");
      errorUrl.searchParams.set("expired_at", err.expiredAt || "");

      return NextResponse.redirect(errorUrl);
    } else if (err.code === "ALREADY_MEMBER") {
      const errorUrl = new URL(`/join-group/error`, request.nextUrl.origin);
      errorUrl.searchParams.set("type", "already_member");
      errorUrl.searchParams.set("group", err.groupName || "Unknown Group");

      return NextResponse.redirect(errorUrl);
    } else if (err.code === "TOKEN_NOT_FOUND" || err.code === "TOKEN_INVALID") {
      const errorUrl = new URL(`/join-group/error`, request.nextUrl.origin);
      errorUrl.searchParams.set("type", "invalid");

      return NextResponse.redirect(errorUrl);
    }

    // Fallback for unexpected errors
    return NextResponse.json(
      { error: "Failed to join the group." },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Invalid token." }, { status: 400 });
}
