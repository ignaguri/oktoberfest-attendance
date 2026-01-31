/**
 * Mobile tutorial step definitions
 *
 * Each step targets a specific component on the home screen or tab bar.
 * Steps with targetId: null are centered modal steps (welcome/complete).
 */

export type TooltipPosition = "top" | "bottom" | "center";

export interface TutorialStep {
  /** Unique identifier for the step */
  id: string;
  /** i18n translation key prefix (e.g., "mobileTutorial.welcome") */
  translationKey: string;
  /** ID of the target component (matches TutorialTarget stepId) */
  targetId: string | null;
  /** Position of tooltip relative to target */
  tooltipPosition: TooltipPosition;
}

/**
 * Tutorial steps for the mobile app
 *
 * Order:
 * 1. Welcome - centered intro message
 * 2. Festival Status - highlight the festival status card
 * 3. Location Sharing - highlight the location sharing card
 * 4. Quick Attendance FAB - highlight the floating action button
 * 5. Complete - centered completion message
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    translationKey: "mobileTutorial.welcome",
    targetId: null,
    tooltipPosition: "center",
  },
  {
    id: "festival-status",
    translationKey: "mobileTutorial.festivalStatus",
    targetId: "festival-status",
    tooltipPosition: "bottom",
  },
  {
    id: "location-sharing",
    translationKey: "mobileTutorial.locationSharing",
    targetId: "location-sharing",
    tooltipPosition: "bottom",
  },
  {
    id: "quick-attendance-fab",
    translationKey: "mobileTutorial.quickAttendance",
    targetId: "quick-attendance-fab",
    tooltipPosition: "top",
  },
  {
    id: "complete",
    translationKey: "mobileTutorial.complete",
    targetId: null,
    tooltipPosition: "center",
  },
];

/** Total number of tutorial steps */
export const TOTAL_STEPS = TUTORIAL_STEPS.length;
