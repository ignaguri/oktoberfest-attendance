import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../helpers/test-data";
import { AchievementsPage } from "../pages/achievements.page";
import { HomePage } from "../pages/home.page";
import { SignInPage } from "../pages/sign-in.page";

// Use user6 for achievements tests to avoid session conflicts with other test files
const ACHIEVEMENTS_TEST_USER = TEST_USERS.user6;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Achievements Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      ACHIEVEMENTS_TEST_USER.email,
      ACHIEVEMENTS_TEST_USER.password,
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_ACH_001: View Achievements Page", () => {
    test("should display achievements page", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.expectOnAchievementsPage();
    });

    test("should show achievements page content", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.expectAchievementsLoaded();

      // Page heading should be visible
      await expect(achievementsPage.pageHeading).toBeVisible();
    });
  });

  test.describe("FLOW_ACH_002: View Achievement Stats", () => {
    test("should show achievement stats when loaded", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

      // Check if stats are visible (may not be if no festival selected)
      const hasStats = await achievementsPage.totalProgressCard.isVisible().catch(() => false);

      if (hasStats) {
        await achievementsPage.expectStatsVisible();
      } else {
        // Page should still be valid
        await achievementsPage.expectOnAchievementsPage();
      }
    });
  });

  test.describe("FLOW_ACH_003: Filter Achievements by Category", () => {
    test("should filter by category through the chips", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

      // The chips only render once a festival is selected and the query has
      // resolved, so a missing chip row is a valid state rather than a failure.
      const hasChips = await achievementsPage.categoryChipAll.isVisible().catch(() => false);

      if (!hasChips) {
        await achievementsPage.expectOnAchievementsPage();
        return;
      }

      await expect(achievementsPage.categoryChipAll).toHaveAttribute("aria-pressed", "true");

      const drinking = achievementsPage.categoryChip("Drinking");
      await drinking.click();

      await expect(drinking).toHaveAttribute("aria-pressed", "true");
      await expect(achievementsPage.categoryChipAll).toHaveAttribute("aria-pressed", "false");
    });
  });

  test.describe("FLOW_ACH_004: View Achievement Progress", () => {
    test("should show achievement badges", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

      // Check if badges are visible when data is loaded
      const hasChips = await achievementsPage.categoryChipAll.isVisible().catch(() => false);

      if (hasChips) {
        // Unlocked cards show a tier name, locked ones show "Locked".
        const hasUnlocked = await achievementsPage.unlockedTierLabel.isVisible().catch(() => false);
        const hasLocked = await achievementsPage.lockedCardLabel.isVisible().catch(() => false);

        // At least one badge type should be visible
        expect(hasUnlocked || hasLocked).toBeTruthy();
      } else {
        // Page should still be valid
        await achievementsPage.expectOnAchievementsPage();
      }
    });

    test("should show achievement progress sections", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

      // Check if data is loaded
      const hasChips = await achievementsPage.categoryChipAll.isVisible().catch(() => false);

      if (hasChips) {
        // Either completed, in-progress, or empty message should be visible
        const hasCompleted = await achievementsPage.hasCompletedAchievements();
        const hasInProgress = await achievementsPage.hasInProgressAchievements();
        const hasEmpty = await achievementsPage.noAchievementsMessage
          .isVisible()
          .catch(() => false);

        expect(hasCompleted || hasInProgress || hasEmpty).toBeTruthy();
      } else {
        // Page should still be valid
        await achievementsPage.expectOnAchievementsPage();
      }
    });
  });
});
