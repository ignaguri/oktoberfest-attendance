import { logger } from "@/lib/logger";
import { createNotificationService } from "@/lib/services/notifications";
import { getUser } from "@/lib/sharedActions";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getUser();
    const body = await request.json();

    // Ensure the subscriber ID matches the authenticated user
    if (body.subscriberId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create notification service and identify user in Novu
    const notificationService = createNotificationService();
    await notificationService.subscribeUser(
      body.subscriberId,
      body.email,
      body.firstName,
      body.lastName,
      body.avatar,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      "Failed to identify user in Novu",
      logger.apiRoute("novu/identify"),
      error as Error,
    );
    return NextResponse.json(
      { error: "Failed to identify user" },
      { status: 500 },
    );
  }
}
