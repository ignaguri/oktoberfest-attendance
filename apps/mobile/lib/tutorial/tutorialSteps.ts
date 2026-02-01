/**
 * Mobile tutorial step definitions
 *
 * Each step targets a specific component on the home screen or tab bar.
 * Steps with targetId: null are centered modal steps (welcome/complete/tab explanations).
 * Steps with tabRoute will navigate to that tab when the step is shown.
 */

export type TooltipPosition = "top" | "bottom" | "center";

/** Tab route paths for navigation */
export type TabRoute =
  | "/(tabs)"
  | "/(tabs)/attendance"
  | "/(tabs)/groups"
  | "/(tabs)/leaderboard"
  | "/(tabs)/profile";

export interface TutorialStep {
  /** Unique identifier for the step */
  id: string;
  /** i18n translation key prefix (e.g., "mobileTutorial.welcome") */
  translationKey: string;
  /** ID of the target component (matches TutorialTarget stepId) */
  targetId: string | null;
  /** Position of tooltip relative to target */
  tooltipPosition: TooltipPosition;
  /** Tab route to navigate to when this step is shown */
  tabRoute?: TabRoute;
}

/**
 * Tutorial steps for the mobile app
 *
 * Order:
 * 1. Welcome - centered intro message
 * 2. Festival Status - highlight the festival status card
 * 3. Location Sharing - highlight the location sharing card
 * 4. Quick Attendance FAB - highlight the floating action button
 * 5. Attendance Tab - centered explanation of the calendar tab
 * 6. Groups Tab - centered explanation of groups/competitions
 * 7. Leaderboard Tab - centered explanation of rankings
 * 8. Profile Tab - centered explanation of settings and tutorial reset
 * 9. Complete - centered completion message
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    translationKey: "mobileTutorial.welcome",
    targetId: null,
    tooltipPosition: "center",
    tabRoute: "/(tabs)", // Ensure we're on home tab
  },
  {
    id: "festival-status",
    translationKey: "mobileTutorial.festivalStatus",
    targetId: "festival-status",
    tooltipPosition: "bottom",
    tabRoute: "/(tabs)", // Home tab
  },
  {
    id: "location-sharing",
    translationKey: "mobileTutorial.locationSharing",
    targetId: "location-sharing",
    tooltipPosition: "bottom",
    tabRoute: "/(tabs)", // Home tab
  },
  {
    id: "quick-attendance-fab",
    translationKey: "mobileTutorial.quickAttendance",
    targetId: "quick-attendance-fab",
    tooltipPosition: "top",
    tabRoute: "/(tabs)", // Home tab (FAB is visible on all tabs but let's keep on home)
  },
  {
    id: "attendance-tab",
    translationKey: "mobileTutorial.attendanceTab",
    targetId: null, // Centered modal - tab content visible behind
    tooltipPosition: "center",
    tabRoute: "/(tabs)/attendance", // Navigate to Attendance tab
  },
  {
    id: "groups-tab",
    translationKey: "mobileTutorial.groupsTab",
    targetId: null, // Centered modal - tab content visible behind
    tooltipPosition: "center",
    tabRoute: "/(tabs)/groups", // Navigate to Groups tab
  },
  {
    id: "leaderboard-tab",
    translationKey: "mobileTutorial.leaderboardTab",
    targetId: null, // Centered modal - tab content visible behind
    tooltipPosition: "center",
    tabRoute: "/(tabs)/leaderboard", // Navigate to Leaderboard tab
  },
  {
    id: "profile-tab",
    translationKey: "mobileTutorial.profileTab",
    targetId: null, // Centered modal - tab content visible behind
    tooltipPosition: "center",
    tabRoute: "/(tabs)/profile", // Navigate to Profile tab
  },
  {
    id: "complete",
    translationKey: "mobileTutorial.complete",
    targetId: null,
    tooltipPosition: "center",
    tabRoute: "/(tabs)/profile", // Stay on profile (where reset tutorial is)
  },
];

/** Total number of tutorial steps */
export const TOTAL_STEPS = TUTORIAL_STEPS.length;
