import { test, expect } from "@playwright/test";

import { SignInPage } from "../pages/sign-in.page";
import { HomePage } from "../pages/home.page";
import { TEST_USERS } from "../helpers/test-data";

// Use a different user than auth tests to avoid session conflicts
const ATTENDANCE_TEST_USER = TEST_USERS.user1;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Attendance Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      ATTENDANCE_TEST_USER.email,
      ATTENDANCE_TEST_USER.password,
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_ATT_001: Quick Attendance from Home Page", () => {
    test("should display quick attendance section on home page", async ({
      page,
    }) => {
      const homePage = new HomePage(page);

      // Wait for the form to be ready
      await page.waitForLoadState("networkidle");

      // Check if festival is active (quick attendance shown) or ended (wrapped shown)
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (isFestivalEnded) {
        // Festival is over - verify the ended state UI is shown instead
        await expect(festivalEndedMessage).toBeVisible();
        // Skip the rest of this test since quick attendance isn't available
        test.skip();
        return;
      }

      // Verify the attendance form is visible when festival is active
      await expect(homePage.tentSelector).toBeVisible({ timeout: 10000 });
      await expect(homePage.beerCountDisplay).toBeVisible({ timeout: 10000 });
    });

    test("should select a tent from the dropdown", async ({ page }) => {
      const homePage = new HomePage(page);

      // Wait for the form to be ready
      await page.waitForLoadState("networkidle");

      // Check if festival is active
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isFestivalEnded) {
        test.skip();
        return;
      }

      // Click the tent selector
      await expect(homePage.tentSelector).toBeVisible({ timeout: 10000 });
      await homePage.tentSelector.click();

      // Wait for the dropdown to appear
      await page.waitForTimeout(500);

      // Verify options are visible
      const options = page.getByRole("option");
      await expect(options.first()).toBeVisible();

      // Select the first available tent
      await options.first().click();

      // Verify tent was selected (combobox should show the selected value)
      await page.waitForTimeout(500);
      const selectedValue = await homePage.tentSelector.textContent();
      expect(selectedValue).not.toBe("Select your current tent");
    });
  });

  test.describe("FLOW_ATT_002: Increment Beer Count", () => {
    test("should increment beer count", async ({ page }) => {
      const homePage = new HomePage(page);

      // Check if festival is active
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isFestivalEnded) {
        test.skip();
        return;
      }

      // Get initial beer count
      const initialCount = await homePage.getBeerCount();

      // Click increment button
      await homePage.incrementBeerCount();

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify count increased
      const newCount = await homePage.getBeerCount();
      expect(newCount).toBe(initialCount + 1);
    });

    test("should show toast after incrementing", async ({ page }) => {
      const homePage = new HomePage(page);

      // Check if festival is active
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isFestivalEnded) {
        test.skip();
        return;
      }

      // Click increment button
      await homePage.incrementBeerCount();

      // Verify toast appears
      const toast = homePage.getToast();
      await expect(toast).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("FLOW_ATT_003: Decrement Beer Count", () => {
    test("should decrement beer count when count is above 0", async ({
      page,
    }) => {
      const homePage = new HomePage(page);

      // Check if festival is active
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isFestivalEnded) {
        test.skip();
        return;
      }

      // Get current count
      const initialCount = await homePage.getBeerCount();

      // First increment to ensure we have at least 1
      await homePage.incrementBeerCount();
      await page.waitForTimeout(1500);

      // Get count after increment (should be initial + 1)
      const countAfterIncrement = await homePage.getBeerCount();
      expect(countAfterIncrement).toBeGreaterThanOrEqual(initialCount);

      // Now decrement
      await homePage.decrementBeerCount();
      await page.waitForTimeout(1500);

      // Verify count decreased (should be less than after increment)
      const countAfterDecrement = await homePage.getBeerCount();
      expect(countAfterDecrement).toBeLessThan(countAfterIncrement);
    });

    test("should not go below 0 when decrementing", async ({ page }) => {
      const homePage = new HomePage(page);

      // Check if festival is active
      const festivalEndedMessage = page.getByText(/is over|has ended/i);
      const isFestivalEnded = await festivalEndedMessage
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isFestivalEnded) {
        test.skip();
        return;
      }

      // Get current count
      const initialCount = await homePage.getBeerCount();

      // Decrement button should work even at 0 (just stays at 0)
      await homePage.decrementBeerCount();
      await page.waitForTimeout(500);

      const newCount = await homePage.getBeerCount();
      // Should either be initial-1 (if initial > 0) or stay at 0
      expect(newCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("FLOW_ATT_004: Navigate to Attendance Page", () => {
    test("should access attendance page directly", async ({ page }) => {
      // Navigate directly to attendance page via URL
      // Note: There's no attendance link in the main navigation
      await page.goto("/attendance");

      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Verify we're on the attendance page
      await expect(page).toHaveURL(/\/attendance/);
    });
  });

  test.describe("FLOW_ATT_005: View Attendance History", () => {
    test("should display attendance page content", async ({ page }) => {
      // Navigate directly to attendance page
      await page.goto("/attendance");

      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Verify page has loaded - check for main content area
      // The page shows attendance records or a table
      const mainContent = page.getByRole("main");
      await expect(mainContent).toBeVisible();
    });
  });
});
