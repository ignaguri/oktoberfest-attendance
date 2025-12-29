import { serve } from "@novu/framework/next";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import {
  groupJoinWorkflow,
  tentCheckinWorkflow,
  reservationReminderWorkflow,
  reservationPromptWorkflow,
  achievementUnlockedWorkflow,
  groupAchievementUnlockedWorkflow,
} from "../../../novu/workflows";

// Tell Next.js this is a dynamic route that should not be pre-rendered during build
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Try to initialize Novu handlers, but gracefully handle missing config during build
let handlers: ReturnType<typeof serve> | null = null;

try {
  handlers = serve({
    workflows: [
      groupJoinWorkflow,
      tentCheckinWorkflow,
      reservationReminderWorkflow,
      reservationPromptWorkflow,
      achievementUnlockedWorkflow,
      groupAchievementUnlockedWorkflow,
    ],
  });
} catch (error) {
  // During build, Novu might not be configured - this is expected
  console.warn(
    "Novu initialization skipped (likely during build):",
    error instanceof Error ? error.message : error,
  );
}

// Fallback handlers when Novu is not configured
const fallbackHandler = (req: NextRequest) => {
  return NextResponse.json(
    {
      error:
        "Novu is not configured. Set NOVU_SECRET_KEY environment variable.",
    },
    { status: 503 },
  );
};

const fallbackOptions = (req: NextRequest) => {
  return new NextResponse(null, { status: 204 });
};

// Export handlers with fallbacks
export const GET = handlers?.GET ?? fallbackHandler;
export const POST = handlers?.POST ?? fallbackHandler;
export const OPTIONS = handlers?.OPTIONS ?? fallbackOptions;
