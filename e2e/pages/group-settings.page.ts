import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Group Settings page (/group-settings/[id])
 * Handles viewing and editing group settings, managing members.
 */
export class GroupSettingsPage extends BasePage {
  readonly path = "/group-settings";

  // Page heading
  readonly pageHeading: Locator;

  // Group details form
  readonly groupNameInput: Locator;
  readonly passwordInput: Locator;
  readonly descriptionInput: Locator;
  readonly updateButton: Locator;

  // Invite link section
  readonly inviteLinkHeading: Locator;
  readonly generateLinkButton: Locator;
  readonly copyLinkButton: Locator;

  // Members section
  readonly membersHeading: Locator;
  readonly membersTable: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading
    this.pageHeading = page.getByRole("heading", { name: "Group Settings" });

    // Group details form
    this.groupNameInput = page.getByLabel("Group Name");
    this.passwordInput = page.getByLabel("Group Password");
    this.descriptionInput = page.getByLabel("Group Description");
    this.updateButton = page.getByRole("button", { name: /update group/i });

    // Invite link section
    this.inviteLinkHeading = page.getByRole("heading", { name: "Invite Link" });
    this.generateLinkButton = page.getByRole("button", {
      name: /generate.*invite link/i,
    });
    this.copyLinkButton = page.getByRole("button", { name: /copy/i });

    // Members section
    this.membersHeading = page.getByRole("heading", { name: "Group Members" });
    this.membersTable = page.getByRole("table");
  }

  /**
   * Navigate to settings for a specific group
   */
  async gotoSettings(groupId: string): Promise<void> {
    await this.page.goto(`${this.path}/${groupId}`);
  }

  /**
   * Assert that we're on a group settings page
   */
  async expectOnSettingsPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/group-settings\/[a-zA-Z0-9-]+/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Assert settings form is visible with group details
   */
  async expectSettingsFormVisible(): Promise<void> {
    await expect(this.groupNameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  /**
   * Assert members section is visible
   */
  async expectMembersSectionVisible(): Promise<void> {
    await expect(this.membersHeading).toBeVisible();
    await expect(this.membersTable).toBeVisible();
  }

  /**
   * Get the current group name from the input
   */
  async getGroupName(): Promise<string> {
    return (await this.groupNameInput.inputValue()) || "";
  }

  /**
   * Update group name
   */
  async updateGroupName(name: string): Promise<void> {
    await this.groupNameInput.clear();
    await this.groupNameInput.fill(name);
  }

  /**
   * Update group description
   */
  async updateDescription(description: string): Promise<void> {
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
  }

  /**
   * Submit the update form
   */
  async submitUpdate(): Promise<void> {
    await this.updateButton.click();
  }

  /**
   * Get the number of members in the table
   */
  async getMembersCount(): Promise<number> {
    const rows = this.membersTable.locator("tbody tr");
    return await rows.count();
  }

  /**
   * Assert that a member is visible in the table
   */
  async expectMemberVisible(username: string | RegExp): Promise<void> {
    await expect(this.membersTable.getByText(username)).toBeVisible();
  }

  /**
   * Assert that the invite link section is visible (creator only)
   */
  async expectInviteLinkSectionVisible(): Promise<void> {
    await expect(this.inviteLinkHeading).toBeVisible();
    await expect(this.generateLinkButton).toBeVisible();
  }

  /**
   * Generate a new invite link
   */
  async generateInviteLink(): Promise<void> {
    await this.generateLinkButton.click();
  }
}
