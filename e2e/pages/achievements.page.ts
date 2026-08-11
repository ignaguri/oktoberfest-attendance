import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Achievements page (/achievements)
 * Handles viewing achievements and progress.
 */
export class AchievementsPage extends BasePage {
  readonly path = "/achievements";

  // Page heading
  readonly pageHeading: Locator;

  // Stats cards
  readonly totalProgressCard: Locator;
  readonly totalPointsCard: Locator;
  readonly rarityBreakdownCard: Locator;
  readonly categoriesCard: Locator;

  // Filter chips (replaced the category combobox in the achievements revamp)
  readonly categoryChipAll: Locator;

  // Achievement sections
  readonly completedHeading: Locator;
  readonly inProgressHeading: Locator;

  // Card state labels
  readonly unlockedTierLabel: Locator;
  readonly lockedCardLabel: Locator;

  // Loading/empty states
  readonly loadingMessage: Locator;
  readonly noAchievementsMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading
    this.pageHeading = page.getByRole("heading", { name: /achievements/i });

    // Stats cards - use title text
    this.totalProgressCard = page.getByText(/total progress/i);
    this.totalPointsCard = page.getByText(/total points/i);
    this.rarityBreakdownCard = page.getByText(/rarity breakdown/i);
    this.categoriesCard = page.getByText("Categories").first();

    // Category filter chips: <button aria-pressed> wrapping a Badge
    this.categoryChipAll = page.getByRole("button", {
      name: "All Achievements",
      exact: true,
    });

    // Achievement sections - one pair renders per category, so scope to the first
    this.completedHeading = page.getByRole("heading", { name: /completed/i }).first();
    this.inProgressHeading = page
      .getByRole("heading", {
        name: /in progress/i,
      })
      .first();

    // Card state labels: an unlocked card shows its tier name, a locked one
    // shows "Locked". Exact matching keeps "Locked" from also catching the
    // stats card's "12% unlocked".
    this.unlockedTierLabel = page.getByText(/^(Bronze|Silver|Gold|Platinum)$/).first();
    this.lockedCardLabel = page.getByText("Locked", { exact: true }).first();

    // Loading/empty states - the page renders common.status.loading, not
    // achievements.loading
    this.loadingMessage = page.getByText("Loading...", { exact: true });
    this.noAchievementsMessage = page.getByText(/no achievements in this category/i);
  }

  /**
   * Assert that we're on the achievements page
   */
  async expectOnAchievementsPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/achievements/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Wait for achievements to finish loading
   */
  async waitForLoad(): Promise<void> {
    // Wait for loading message to disappear
    try {
      await this.loadingMessage.waitFor({ state: "hidden", timeout: 10000 });
    } catch {
      // Loading message may not appear if data loads quickly
    }
  }

  /**
   * Assert that the achievements page is fully loaded with data
   */
  async expectAchievementsLoaded(): Promise<void> {
    await this.expectOnAchievementsPage();
    await this.waitForLoad();
    // Either stats cards or no-festival message should be visible
    const hasStats = await this.totalProgressCard.isVisible().catch(() => false);
    const noFestival = await this.page
      .getByText(/please select a festival/i)
      .isVisible()
      .catch(() => false);
    expect(hasStats || noFestival).toBeTruthy();
  }

  /**
   * Check if stats cards are visible
   */
  async expectStatsVisible(): Promise<void> {
    await expect(this.totalProgressCard).toBeVisible();
    await expect(this.totalPointsCard).toBeVisible();
  }

  /**
   * Locator for one category chip by its visible label
   */
  categoryChip(label: string): Locator {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  /**
   * Check if completed achievements section is visible
   */
  async hasCompletedAchievements(): Promise<boolean> {
    return await this.completedHeading.isVisible().catch(() => false);
  }

  /**
   * Check if in-progress achievements section is visible
   */
  async hasInProgressAchievements(): Promise<boolean> {
    return await this.inProgressHeading.isVisible().catch(() => false);
  }
}
