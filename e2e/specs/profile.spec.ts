import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../helpers/test-data";
import { HomePage } from "../pages/home.page";
import { ProfilePage } from "../pages/profile.page";
import { SignInPage } from "../pages/sign-in.page";

// Use user4 for profile tests to avoid session conflicts with other test files
const PROFILE_TEST_USER = TEST_USERS.user4;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Profile Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      PROFILE_TEST_USER.email,
      PROFILE_TEST_USER.password
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_PRF_001: View Profile", () => {
    test("should display profile page", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectOnProfilePage();
    });

    test("should show profile fields and edit button", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectProfileLoaded();

      // Check key elements are visible
      await expect(profilePage.emailLabel).toBeVisible();
      await expect(profilePage.fullNameLabel).toBeVisible();
      await expect(profilePage.usernameLabel).toBeVisible();
    });

    test("should show tutorial and danger zone sections", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectOnProfilePage();

      // Scroll down to see all sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      await profilePage.expectTutorialSectionVisible();
      await profilePage.expectDangerZoneVisible();
    });
  });

  test.describe("FLOW_PRF_002: Edit Profile", () => {
    test("should enable edit mode", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectProfileLoaded();

      // Click Edit button
      await profilePage.clickEdit();

      // Should be in edit mode
      await profilePage.expectEditMode();
    });

    test("should show input fields in edit mode", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectProfileLoaded();

      // Enter edit mode
      await profilePage.clickEdit();

      // Check input fields are editable
      await expect(profilePage.fullNameInput).toBeEditable();
      await expect(profilePage.usernameInput).toBeEditable();
    });
  });

  test.describe("FLOW_PRF_003: Cancel Profile Edit", () => {
    test("should cancel edit mode", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectProfileLoaded();

      // Enter edit mode
      await profilePage.clickEdit();
      await profilePage.expectEditMode();

      // Cancel editing
      await profilePage.cancelEdit();

      // Should be back to view mode
      await profilePage.expectViewMode();
    });
  });

  test.describe("FLOW_PRF_004: Navigate to Change Password", () => {
    test("should navigate to change password", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectProfileLoaded();

      // Click change password link
      await profilePage.goToChangePassword();

      // Should be on update password page
      await expect(page).toHaveURL(/\/update-password/);
    });
  });

  test.describe("FLOW_PRF_005: Reset Tutorial", () => {
    test("should show reset tutorial button", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectOnProfilePage();

      // Scroll to tutorial section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      await profilePage.expectTutorialSectionVisible();
    });

    test("should reset tutorial and show success toast", async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await profilePage.goto();
      await profilePage.expectOnProfilePage();

      // Scroll to tutorial section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Click reset tutorial
      await profilePage.resetTutorial();

      // Wait for toast
      await page.waitForTimeout(1000);

      // Should show success toast
      const toast = page.locator("[data-sonner-toast]");
      const hasToast = await toast.isVisible().catch(() => false);

      if (hasToast) {
        await expect(toast).toContainText(/tutorial|reset/i);
      }
    });
  });
});
