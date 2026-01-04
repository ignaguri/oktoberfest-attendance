import { logger } from "@/lib/logger";
import { reportApiException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

async function handleJoinGroupRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  try {
    // Get auth token for API call
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      // Redirect to login with return URL
      const loginUrl = new URL("/sign-in", request.nextUrl.origin);
      loginUrl.searchParams.set("redirect", `/join-group?token=${token}`);
      return NextResponse.redirect(loginUrl);
    }

    // Call the API to join by token
    const apiUrl = `${request.nextUrl.origin}${API_BASE_URL}/v1/groups/join-by-token`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inviteToken: token }),
    });

    if (response.ok) {
      const result = await response.json();
      const redirectUrl = new URL(
        "/join-group/success",
        request.nextUrl.origin,
      );
      redirectUrl.searchParams.set("group", result.group?.name || "Group");
      redirectUrl.searchParams.set("group_id", result.group?.id || "");
      return NextResponse.redirect(redirectUrl);
    }

    // Handle error responses
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    const errorMessage = error.message || "Failed to join group";

    // Handle specific error types based on status and message
    if (response.status === 409 || errorMessage.includes("already a member")) {
      // Already a member - get group info from the error or search
      const { data: groupData } = await supabase
        .from("groups")
        .select("id, name")
        .eq("invite_token", token)
        .single();

      const errorUrl = new URL("/join-group/error", request.nextUrl.origin);
      errorUrl.searchParams.set("type", "already_member");
      errorUrl.searchParams.set("group", groupData?.name || "Unknown Group");
      errorUrl.searchParams.set("group_id", groupData?.id || "");
      return NextResponse.redirect(errorUrl);
    } else if (response.status === 404) {
      const errorUrl = new URL("/join-group/error", request.nextUrl.origin);
      errorUrl.searchParams.set("type", "invalid");
      return NextResponse.redirect(errorUrl);
    }

    // Generic error
    return NextResponse.json(
      { error: errorMessage },
      { status: response.status },
    );
  } catch (error) {
    const err = error as Error;
    reportApiException("join-group", err);
    logger.error(
      "Failed to join group with token",
      logger.apiRoute("join-group", { token }),
      err,
    );

    return NextResponse.json(
      { error: "Failed to join the group." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleJoinGroupRequest(request);
}

export async function POST(request: NextRequest) {
  return handleJoinGroupRequest(request);
}
