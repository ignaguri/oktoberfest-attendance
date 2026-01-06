import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Global Leaderboard page (/leaderboard)
 * Handles viewing global rankings and changing winning criteria.
 */
export class LeaderboardPage extends BasePage {
  readonly path = "/leaderboard";

  // Page heading
  readonly pageHeading: Locator;

  // Winning criteria section
  readonly winningCriteriaLabel: Locator;
  readonly winningCriteriaDropdown: Locator;

  // Leaderboard table
  readonly leaderboardTable: Locator;

  // Loading spinner
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading - matches "Global Leaderboard" or "Leaderboard"
    this.pageHeading = page.getByRole("heading", {
      name: /leaderboard/i,
      level: 1,
    });

    // Winning criteria elements
    this.winningCriteriaLabel = page.getByText(/winning criteria/i);
    this.winningCriteriaDropdown = page.getByRole("combobox");

    // Leaderboard table
    this.leaderboardTable = page.getByRole("table");

    // Loading spinner
    this.loadingSpinner = page.locator("[class*='animate-spin']");
  }

  /**
   * Assert that we're on the leaderboard page
   */
  async expectOnLeaderboardPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/leaderboard/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Wait for leaderboard to finish loading
   */
  async waitForLoad(): Promise<void> {
    // Wait for spinner to disappear if present
    try {
      await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 });
    } catch {
      // Spinner may not appear if data loads quickly
    }
  }

  /**
   * Assert that the leaderboard page is fully loaded
   */
  async expectLeaderboardLoaded(): Promise<void> {
    await this.expectOnLeaderboardPage();
    await this.waitForLoad();
    // Either table or winning criteria should be visible
    const hasTable = await this.leaderboardTable.isVisible().catch(() => false);
    const hasCriteria = await this.winningCriteriaLabel
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasCriteria).toBeTruthy();
  }

  /**
   * Check if leaderboard table is visible
   */
  async isLeaderboardVisible(): Promise<boolean> {
    return await this.leaderboardTable.isVisible().catch(() => false);
  }

  /**
   * Get number of entries in the leaderboard
   */
  async getLeaderboardEntriesCount(): Promise<number> {
    const rows = this.leaderboardTable.locator("tbody tr");
    return await rows.count();
  }

  /**
   * Select a winning criteria from the dropdown
   */
  async selectWinningCriteria(criteriaName: string | RegExp): Promise<void> {
    await this.winningCriteriaDropdown.click();
    await this.page.getByRole("option", { name: criteriaName }).click();
  }

  /**
   * Get current selected winning criteria
   */
  async getCurrentCriteria(): Promise<string> {
    return (await this.winningCriteriaDropdown.textContent()) || "";
  }

  /**
   * Check if a specific user is in the leaderboard
   */
  async expectUserInLeaderboard(username: string | RegExp): Promise<void> {
    await expect(this.leaderboardTable.getByText(username)).toBeVisible();
  }
}
