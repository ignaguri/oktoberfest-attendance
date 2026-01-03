import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Group Detail page (/groups/[id])
 * Handles viewing group leaderboard and navigation to sub-pages.
 */
export class GroupDetailPage extends BasePage {
  readonly path = "/groups";

  // Group heading (dynamic based on group name)
  readonly groupHeading: Locator;

  // Leaderboard
  readonly leaderboard: Locator;

  // Navigation buttons
  readonly calendarButton: Locator;
  readonly galleryButton: Locator;
  readonly settingsButton: Locator;

  // Share/QR buttons
  readonly shareButton: Locator;
  readonly qrButton: Locator;

  // Join form (shown when not a member)
  readonly joinFormHeading: Locator;

  constructor(page: Page) {
    super(page);

    // Group heading - contains "Group" and the group name
    this.groupHeading = page.getByRole("heading", { level: 2 });

    // Leaderboard table
    this.leaderboard = page.getByRole("table");

    // Navigation buttons
    this.calendarButton = page.getByRole("link", { name: /calendar/i });
    this.galleryButton = page.getByRole("link", { name: /gallery/i });
    this.settingsButton = page.getByRole("link", { name: /group settings/i });

    // Share and QR buttons
    this.shareButton = page.getByRole("button", { name: /share/i });
    this.qrButton = page.getByRole("button", { name: /qr/i });

    // Join form (when user is not a member)
    this.joinFormHeading = page.getByRole("heading", { name: /join group/i });
  }

  /**
   * Navigate to a specific group by ID
   */
  async gotoGroup(groupId: string): Promise<void> {
    await this.page.goto(`${this.path}/${groupId}`);
  }

  /**
   * Assert that we're on a group detail page
   */
  async expectOnGroupDetailPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9-]+$/);
  }

  /**
   * Assert that the group detail page shows member view (leaderboard)
   */
  async expectMemberView(): Promise<void> {
    await this.expectOnGroupDetailPage();
    await expect(this.leaderboard).toBeVisible({ timeout: 10000 });
    await expect(this.settingsButton).toBeVisible();
  }

  /**
   * Assert that the group detail page shows non-member view (join form)
   */
  async expectNonMemberView(): Promise<void> {
    await this.expectOnGroupDetailPage();
    await expect(this.joinFormHeading).toBeVisible();
  }

  /**
   * Assert group heading contains expected name
   */
  async expectGroupName(name: string | RegExp): Promise<void> {
    await expect(this.groupHeading).toContainText(name);
  }

  /**
   * Navigate to group calendar
   */
  async goToCalendar(): Promise<void> {
    await this.calendarButton.click();
    await this.page.waitForURL(/\/groups\/[^/]+\/calendar/);
  }

  /**
   * Navigate to group gallery
   */
  async goToGallery(): Promise<void> {
    await this.galleryButton.click();
    await this.page.waitForURL(/\/groups\/[^/]+\/gallery/);
  }

  /**
   * Navigate to group settings
   */
  async goToSettings(): Promise<void> {
    await this.settingsButton.click();
    await this.page.waitForURL(/\/group-settings\/[^/]+/);
  }

  /**
   * Get leaderboard entries count
   */
  async getLeaderboardEntriesCount(): Promise<number> {
    const rows = this.page.locator("table tbody tr");
    return await rows.count();
  }
}
