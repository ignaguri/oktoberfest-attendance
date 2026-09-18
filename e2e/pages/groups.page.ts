import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Groups page (/groups)
 * Handles viewing groups list, joining groups, and creating groups.
 */
export class GroupsPage extends BasePage {
  readonly path = "/groups";

  // Page heading
  readonly pageHeading: Locator;

  // My Groups section
  readonly myGroupsSection: Locator;

  // Join Group form
  readonly joinFormHeading: Locator;
  readonly joinGroupNameInput: Locator;
  readonly joinInviteLinkInput: Locator;
  readonly joinButton: Locator;
  readonly requestToJoinButton: Locator;

  // Create Group form
  readonly createFormHeading: Locator;
  readonly createGroupNameInput: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading
    this.pageHeading = page.getByRole("heading", { name: "Groups", level: 1 });

    // My Groups section
    this.myGroupsSection = page.getByText(/my groups/i);

    // Join Group form - use heading to locate the form section
    // Placeholder translations: groups.join.namePlaceholder: "Group Name", groups.join.inviteLinkPlaceholder: "Paste the invite link"
    // The DOM holds a second, hidden copy of the forms, so inputs are scoped to the visible form
    this.joinFormHeading = page.getByRole("heading", { name: "Join a Group" });
    const joinForm = page.locator("form").filter({ visible: true, has: this.joinFormHeading });
    this.joinGroupNameInput = joinForm.getByPlaceholder(/^group name$/i);
    this.joinInviteLinkInput = joinForm.getByPlaceholder(/^paste the invite link$/i);
    this.joinButton = joinForm.getByRole("button", { name: /^join group$/i });
    this.requestToJoinButton = joinForm.getByRole("button", { name: /^request to join$/i });

    // Create Group form - heading text from groups.create.title: "Create Group"
    // Placeholder translation: groups.create.namePlaceholder: "Enter group name"
    this.createFormHeading = page.getByRole("heading", {
      name: /create group/i,
    });
    this.createGroupNameInput = page.getByPlaceholder(/enter group name/i).filter({ visible: true });
    this.createButton = page
      .getByRole("button", { name: /^create group$/i })
      .filter({ visible: true });
  }

  /**
   * Assert that we're on the groups page
   */
  async expectOnGroupsPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/groups$/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Assert that the groups page is fully loaded with forms
   */
  async expectGroupsPageLoaded(): Promise<void> {
    await this.expectOnGroupsPage();
    await expect(this.joinFormHeading).toBeVisible();
    await expect(this.createFormHeading).toBeVisible();
  }

  /**
   * Fill the join group form
   */
  async fillJoinForm(groupName: string, inviteLink: string): Promise<void> {
    await this.joinGroupNameInput.fill(groupName);
    await this.joinInviteLinkInput.fill(inviteLink);
  }

  /**
   * Submit the join group form
   */
  async submitJoinForm(): Promise<void> {
    await this.joinButton.click();
  }

  /**
   * Join a group with name and invite link
   */
  async joinGroup(groupName: string, inviteLink: string): Promise<void> {
    await this.fillJoinForm(groupName, inviteLink);
    await this.submitJoinForm();
  }

  /**
   * Ask a group's creator to join, by name only
   */
  async requestToJoin(groupName: string): Promise<void> {
    await this.joinGroupNameInput.fill(groupName);
    await this.requestToJoinButton.click();
  }

  /**
   * Fill the create group form
   */
  async fillCreateForm(groupName: string): Promise<void> {
    await this.createGroupNameInput.fill(groupName);
  }

  /**
   * Submit the create group form
   */
  async submitCreateForm(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Create a new group with a name
   */
  async createGroup(groupName: string): Promise<void> {
    await this.fillCreateForm(groupName);
    await this.submitCreateForm();
  }

  /**
   * Click on a group in the My Groups list
   */
  async clickGroup(groupName: string | RegExp): Promise<void> {
    await this.page.getByRole("link", { name: groupName }).click();
  }

  /**
   * Assert that a specific group is visible in My Groups
   */
  async expectGroupVisible(groupName: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("link", { name: groupName })).toBeVisible();
  }

  /**
   * Assert success toast for joining group
   */
  async expectJoinSuccess(): Promise<void> {
    await this.expectSuccessToast(/successfully joined/i);
  }

  /**
   * Assert success toast for creating group
   */
  async expectCreateSuccess(): Promise<void> {
    await this.expectSuccessToast(/group created/i);
  }

  /**
   * Assert error toast for join failure
   */
  async expectJoinError(): Promise<void> {
    await this.expectErrorToast(/invalid invite|unable to join/i);
  }
}
