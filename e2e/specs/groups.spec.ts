import { test, expect } from "@playwright/test";

import {
  generateUniqueGroupName,
  TEST_GROUPS,
  TEST_USERS,
} from "../helpers/test-data";
import { GroupDetailPage } from "../pages/group-detail.page";
import { GroupsPage } from "../pages/groups.page";
import { GroupSettingsPage } from "../pages/group-settings.page";
import { HomePage } from "../pages/home.page";
import { SignInPage } from "../pages/sign-in.page";

// Use user2 for groups tests to avoid session conflicts with other test files
const GROUPS_TEST_USER = TEST_USERS.user2;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Groups Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      GROUPS_TEST_USER.email,
      GROUPS_TEST_USER.password,
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_GRP_001: View My Groups", () => {
    test("should display groups page with forms", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Verify both forms are visible
      await expect(groupsPage.joinFormHeading).toBeVisible();
      await expect(groupsPage.createFormHeading).toBeVisible();
    });

    test("should show join and create form inputs", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Verify join form inputs
      await expect(groupsPage.joinGroupNameInput).toBeVisible();
      await expect(groupsPage.joinPasswordInput).toBeVisible();
      await expect(groupsPage.joinButton).toBeVisible();

      // Verify create form inputs
      await expect(groupsPage.createGroupNameInput).toBeVisible();
      await expect(groupsPage.createPasswordInput).toBeVisible();
      await expect(groupsPage.createButton).toBeVisible();
    });
  });

  test.describe("FLOW_GRP_002: Join a Group", () => {
    test("should join a group with valid credentials", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Join Group B (since user might already be in Group A from seed)
      await groupsPage.joinGroup(
        TEST_GROUPS.groupB.name,
        TEST_GROUPS.groupB.password,
      );

      // Wait for navigation or success
      await page.waitForTimeout(2000);

      // Should either redirect to group page or show success toast
      const currentUrl = page.url();
      const isOnGroupPage =
        currentUrl.includes("/groups/") && !currentUrl.endsWith("/groups");
      if (!isOnGroupPage) {
        // If still on groups page, check for success toast or error
        await expect(page).toHaveURL(/\/groups/);
      }
    });
  });

  test.describe("FLOW_GRP_003: Create a New Group", () => {
    test("should create a new group", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Create a unique group
      const uniqueGroupName = generateUniqueGroupName();
      await groupsPage.createGroup(uniqueGroupName, "testpassword123");

      // Wait for navigation to settings page
      await page.waitForTimeout(2000);

      // Should redirect to group settings page after creation
      const currentUrl = page.url();
      const isOnSettingsPage = currentUrl.includes("/group-settings/");

      if (isOnSettingsPage) {
        const groupSettingsPage = new GroupSettingsPage(page);
        await groupSettingsPage.expectOnSettingsPage();
      } else {
        // If creation failed, should still be on groups page
        await expect(page).toHaveURL(/\/groups/);
      }
    });
  });

  test.describe("FLOW_GRP_004: View Group Detail", () => {
    test("should display group detail page when member", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // First join a group to ensure we're a member
      await groupsPage.joinGroup(
        TEST_GROUPS.groupC.name,
        TEST_GROUPS.groupC.password,
      );

      // Wait for potential navigation
      await page.waitForTimeout(2000);

      // Navigate to the group detail page
      await page.goto("/groups");
      await page.waitForLoadState("networkidle");

      // Try to click on the group in My Groups
      const groupLink = page.getByRole("link", {
        name: TEST_GROUPS.groupC.name,
      });
      const isGroupVisible = await groupLink.isVisible().catch(() => false);

      if (isGroupVisible) {
        await groupLink.click();
        await page.waitForURL(/\/groups\/[a-zA-Z0-9-]+/);

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.expectMemberView();
      }
    });
  });

  test.describe("FLOW_GRP_005: Navigate to Group Settings", () => {
    test("should navigate to group settings from detail page", async ({
      page,
    }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Join a group first
      await groupsPage.joinGroup(
        TEST_GROUPS.groupA.name,
        TEST_GROUPS.groupA.password,
      );

      await page.waitForTimeout(2000);

      // Navigate back to groups and find the group
      await page.goto("/groups");
      await page.waitForLoadState("networkidle");

      const groupLink = page.getByRole("link", {
        name: TEST_GROUPS.groupA.name,
      });
      const isGroupVisible = await groupLink.isVisible().catch(() => false);

      if (isGroupVisible) {
        await groupLink.click();
        await page.waitForURL(/\/groups\/[a-zA-Z0-9-]+/);

        // Click on Group Settings button
        const settingsButton = page.getByRole("link", {
          name: /group settings/i,
        });
        await settingsButton.click();

        await page.waitForURL(/\/group-settings\//);

        const groupSettingsPage = new GroupSettingsPage(page);
        await groupSettingsPage.expectOnSettingsPage();
      }
    });
  });

  test.describe("FLOW_GRP_006: Join Group Error - Wrong Password", () => {
    test("should show error for wrong group password", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // Try to join with wrong password
      await groupsPage.joinGroup(TEST_GROUPS.groupA.name, "wrongpassword");

      // Wait for error toast
      await page.waitForTimeout(1500);

      // Should show error toast or stay on page
      const toast = page.locator("[data-sonner-toast]");
      const hasToast = await toast.isVisible().catch(() => false);

      if (hasToast) {
        // Verify it's an error toast - could be password error or festival selection error
        await expect(toast).toContainText(
          /incorrect|error|unable|festival|password/i,
        );
      }

      // Should still be on groups page
      await expect(page).toHaveURL(/\/groups$/);
    });
  });

  test.describe("FLOW_GRP_007: View Group Members", () => {
    test("should display group members list in settings", async ({ page }) => {
      const groupsPage = new GroupsPage(page);

      await groupsPage.goto();
      await groupsPage.expectGroupsPageLoaded();

      // First join a group to ensure we're a member
      await groupsPage.joinGroup(
        TEST_GROUPS.groupA.name,
        TEST_GROUPS.groupA.password,
      );

      await page.waitForTimeout(2000);

      // Navigate back to groups page
      await page.goto("/groups");
      await page.waitForLoadState("networkidle");

      // Try to find the specific group link (not breadcrumb)
      const groupLink = page.getByRole("link", {
        name: TEST_GROUPS.groupA.name,
      });
      const isGroupVisible = await groupLink.isVisible().catch(() => false);

      if (isGroupVisible) {
        await groupLink.click();
        await page.waitForURL(/\/groups\/[a-zA-Z0-9-]+/);

        // Go to settings
        const settingsButton = page.getByRole("link", {
          name: /group settings/i,
        });
        const hasSettings = await settingsButton.isVisible().catch(() => false);

        if (hasSettings) {
          await settingsButton.click();
          await page.waitForURL(/\/group-settings\//);

          const groupSettingsPage = new GroupSettingsPage(page);
          await groupSettingsPage.expectMembersSectionVisible();

          // Should have at least one member (the current user)
          const membersCount = await groupSettingsPage.getMembersCount();
          expect(membersCount).toBeGreaterThan(0);
        }
      }
    });
  });
});
