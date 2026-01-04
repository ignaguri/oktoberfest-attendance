import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Profile page (/profile)
 * Handles viewing and editing user profile information.
 */
export class ProfilePage extends BasePage {
  readonly path = "/profile";

  // Page heading
  readonly pageHeading: Locator;

  // Profile fields (view mode)
  readonly emailLabel: Locator;
  readonly fullNameLabel: Locator;
  readonly usernameLabel: Locator;

  // Edit mode inputs
  readonly fullNameInput: Locator;
  readonly usernameInput: Locator;

  // Buttons
  readonly editButton: Locator;
  readonly updateButton: Locator;
  readonly cancelButton: Locator;
  readonly changePasswordLink: Locator;

  // Tutorial section
  readonly tutorialHeading: Locator;
  readonly resetTutorialButton: Locator;

  // Danger zone
  readonly dangerZoneHeading: Locator;
  readonly deleteAccountButton: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading
    this.pageHeading = page.getByRole("heading", { name: /your profile/i });

    // Profile field labels
    this.emailLabel = page.getByText(/^email:/i);
    this.fullNameLabel = page.getByText(/full\s*name:/i);
    this.usernameLabel = page.getByText(/^username:/i);

    // Edit mode inputs
    this.fullNameInput = page.getByRole("textbox", { name: /full\s*name/i });
    this.usernameInput = page.getByRole("textbox", { name: /username/i });

    // Buttons
    this.editButton = page.getByRole("button", { name: "Edit" });
    this.updateButton = page.getByRole("button", { name: /^update$/i });
    this.cancelButton = page.getByRole("button", { name: "Cancel" });
    this.changePasswordLink = page.getByRole("link", {
      name: /change password/i,
    });

    // Tutorial section
    this.tutorialHeading = page.getByRole("heading", { name: "Tutorial" });
    this.resetTutorialButton = page.getByRole("button", {
      name: /reset tutorial/i,
    });

    // Danger zone
    this.dangerZoneHeading = page.getByRole("heading", {
      name: /danger zone/i,
    });
    this.deleteAccountButton = page.getByRole("button", {
      name: /delete account/i,
    });
  }

  /**
   * Assert that we're on the profile page
   */
  async expectOnProfilePage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/profile/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Assert that profile page is fully loaded with user data
   */
  async expectProfileLoaded(): Promise<void> {
    await this.expectOnProfilePage();
    await expect(this.emailLabel).toBeVisible();
    await expect(this.editButton).toBeVisible();
  }

  /**
   * Click the Edit button to enter edit mode
   */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
  }

  /**
   * Assert that we're in edit mode
   */
  async expectEditMode(): Promise<void> {
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.updateButton).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
  }

  /**
   * Assert that we're in view mode (not editing)
   */
  async expectViewMode(): Promise<void> {
    await expect(this.editButton).toBeVisible();
    await expect(this.updateButton).not.toBeVisible();
  }

  /**
   * Update profile with new values
   */
  async updateProfile(fullName?: string, username?: string): Promise<void> {
    if (fullName) {
      await this.fullNameInput.clear();
      await this.fullNameInput.fill(fullName);
    }
    if (username) {
      await this.usernameInput.clear();
      await this.usernameInput.fill(username);
    }
    await this.updateButton.click();
  }

  /**
   * Cancel editing
   */
  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Navigate to change password page
   */
  async goToChangePassword(): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/\/update-password/, { waitUntil: "commit" }),
      this.changePasswordLink.click(),
    ]);
  }

  /**
   * Reset the tutorial
   */
  async resetTutorial(): Promise<void> {
    await this.resetTutorialButton.click();
  }

  /**
   * Assert tutorial section is visible
   */
  async expectTutorialSectionVisible(): Promise<void> {
    await expect(this.tutorialHeading).toBeVisible();
    await expect(this.resetTutorialButton).toBeVisible();
  }

  /**
   * Assert danger zone is visible
   */
  async expectDangerZoneVisible(): Promise<void> {
    await expect(this.dangerZoneHeading).toBeVisible();
    await expect(this.deleteAccountButton).toBeVisible();
  }
}
