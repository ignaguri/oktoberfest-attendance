#!/usr/bin/env tsx
import { Novu } from "@novu/api";

import type {
  CreateWorkflowDto,
  UpdateWorkflowDto,
} from "@novu/api/models/components";

import { achievementUnlockedWorkflow } from "../novu/workflows/achievement-unlocked";
import { groupAchievementUnlockedWorkflow } from "../novu/workflows/group-achievement-unlocked";
import { groupJoinWorkflow } from "../novu/workflows/group-join";
import { reservationPromptWorkflow } from "../novu/workflows/reservation-prompt";
import { reservationReminderWorkflow } from "../novu/workflows/reservation-reminder";
import { tentCheckinWorkflow } from "../novu/workflows/tent-check-in";

const WORKFLOWS: CreateWorkflowDto[] = [
  groupJoinWorkflow,
  tentCheckinWorkflow,
  reservationReminderWorkflow,
  reservationPromptWorkflow,
  achievementUnlockedWorkflow,
  groupAchievementUnlockedWorkflow,
];

async function upsertWorkflow(novu: Novu, workflowData: CreateWorkflowDto) {
  try {
    // Check if workflow exists by trying to get it
    const existingWorkflow = await novu.workflows.get(workflowData.workflowId);

    // Update existing workflow - preserve existing preferences
    const updateData: UpdateWorkflowDto = {
      name: workflowData.name,
      tags: workflowData.tags,
      steps: workflowData.steps,
      active: workflowData.active,
      // Preserve existing preferences from the fetched workflow
      preferences: existingWorkflow.result.preferences,
      origin: "external",
    };

    await novu.workflows.update(updateData, workflowData.workflowId);
  } catch {
    // Create new workflow with default preferences
    const createData: CreateWorkflowDto = {
      ...workflowData,
      preferences: {
        user: {
          all: { enabled: true },
          channels: {
            in_app: { enabled: true },
            push: { enabled: true },
          },
        },
      },
    };

    await novu.workflows.create(createData);
  }
}

async function main() {
  const apiKey = process.env.NOVU_API_KEY;
  if (!apiKey) throw new Error("NOVU_API_KEY is required");
  const novu = new Novu({ secretKey: apiKey });

  for (const wf of WORKFLOWS) {
    // eslint-disable-next-line no-console
    console.log(`Syncing workflow: ${wf.workflowId}`);
    await upsertWorkflow(novu, wf);
  }
  // eslint-disable-next-line no-console
  console.log("Novu workflows synced.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
