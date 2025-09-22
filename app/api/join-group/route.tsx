import { logger } from "@/lib/logger";
import { reportApiException } from "@/utils/sentry";
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
      const redirectUrl = new URL(`/groups/${groupId}`, request.nextUrl.origin);

      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    reportApiException("join-group", error as Error);
    logger.error(
      "Failed to join group with token",
      logger.apiRoute("join-group", { token }),
      error as Error,
    );
    return NextResponse.json(
      { error: "Failed to join the group." },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Invalid token." }, { status: 400 });
}
