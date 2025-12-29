import { serve } from "@novu/framework/next";

import {
  groupJoinWorkflow,
  tentCheckinWorkflow,
  reservationReminderWorkflow,
  reservationPromptWorkflow,
  achievementUnlockedWorkflow,
  groupAchievementUnlockedWorkflow,
} from "../../../novu/workflows";

// This will create GET, POST, and OPTIONS handlers for the bridge endpoint
export const { GET, POST, OPTIONS } = serve({
  workflows: [
    groupJoinWorkflow,
    tentCheckinWorkflow,
    reservationReminderWorkflow,
    reservationPromptWorkflow,
    achievementUnlockedWorkflow,
    groupAchievementUnlockedWorkflow,
  ],
});
