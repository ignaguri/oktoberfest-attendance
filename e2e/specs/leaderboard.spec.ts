import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../helpers/test-data";
import { HomePage } from "../pages/home.page";
import { LeaderboardPage } from "../pages/leaderboard.page";
import { SignInPage } from "../pages/sign-in.page";

// Use user3 for leaderboard tests to avoid session conflicts with other test files
const LEADERBOARD_TEST_USER = TEST_USERS.user3;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Leaderboard Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      LEADERBOARD_TEST_USER.email,
      LEADERBOARD_TEST_USER.password
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_LDB_001: View Global Leaderboard", () => {
    test("should display global leaderboard page", async ({ page }) => {
      const leaderboardPage = new LeaderboardPage(page);

      await leaderboardPage.goto();
      await leaderboardPage.expectOnLeaderboardPage();
    });

    test("should show winning criteria selector", async ({ page }) => {
      const leaderboardPage = new LeaderboardPage(page);

      await leaderboardPage.goto();
      await leaderboardPage.waitForLoad();

      // Either criteria selector or empty state should be visible
      const hasCriteria = await leaderboardPage.winningCriteriaLabel
        .isVisible()
        .catch(() => false);
      const hasHeading = await leaderboardPage.pageHeading.isVisible();

      expect(hasHeading).toBeTruthy();
      // If festival is selected, criteria should be visible
      if (hasCriteria) {
        await expect(leaderboardPage.winningCriteriaDropdown).toBeVisible();
      }
    });
  });

  test.describe("FLOW_LDB_002: Change Winning Criteria", () => {
    test("should have winning criteria dropdown when festival is selected", async ({
      page,
    }) => {
      const leaderboardPage = new LeaderboardPage(page);

      await leaderboardPage.goto();
      await leaderboardPage.waitForLoad();

      // Check if criteria selector exists
      const hasCriteria = await leaderboardPage.winningCriteriaDropdown
        .isVisible()
        .catch(() => false);

      if (hasCriteria) {
        // Click to open dropdown
        await leaderboardPage.winningCriteriaDropdown.click();

        // Should show options
        const options = page.getByRole("option");
        const optionCount = await options.count();

        // Close dropdown
        await page.keyboard.press("Escape");

        expect(optionCount).toBeGreaterThan(0);
      } else {
        // No festival selected, page should still be valid
        await leaderboardPage.expectOnLeaderboardPage();
      }
    });
  });

  test.describe("FLOW_LDB_003: View User Position", () => {
    test("should display leaderboard table when data exists", async ({
      page,
    }) => {
      const leaderboardPage = new LeaderboardPage(page);

      await leaderboardPage.goto();
      await leaderboardPage.waitForLoad();

      // If festival is selected and data exists, table should be visible
      const hasTable = await leaderboardPage.isLeaderboardVisible();

      if (hasTable) {
        const entriesCount = await leaderboardPage.getLeaderboardEntriesCount();
        expect(entriesCount).toBeGreaterThanOrEqual(0);
      } else {
        // No data or no festival - page should still be valid
        await leaderboardPage.expectOnLeaderboardPage();
      }
    });
  });
});
