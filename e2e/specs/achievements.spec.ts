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

      await achievementsPage.expectStatsVisible();
    });
  });

  test.describe("FLOW_ACH_003: Filter Achievements by Category", () => {
    test("should filter by category through the chips", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

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

      // Unlocked cards show a tier name, locked ones show "Locked". Which one
      // the seed produces depends on the test user's progress, so assert that
      // the grid rendered cards in one state or the other.
      const hasUnlocked = await achievementsPage.unlockedTierLabel.isVisible();
      const hasLocked = await achievementsPage.lockedCardLabel.isVisible();

      expect(hasUnlocked || hasLocked).toBeTruthy();
    });

    test("should show achievement progress sections", async ({ page }) => {
      const achievementsPage = new AchievementsPage(page);

      await achievementsPage.goto();
      await achievementsPage.waitForLoad();

      // Either completed, in-progress, or empty message should be visible
      const hasCompleted = await achievementsPage.hasCompletedAchievements();
      const hasInProgress = await achievementsPage.hasInProgressAchievements();
      const hasEmpty = await achievementsPage.noAchievementsMessage.isVisible();

      expect(hasCompleted || hasInProgress || hasEmpty).toBeTruthy();
    });
  });
});
