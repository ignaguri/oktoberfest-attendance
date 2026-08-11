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

  // Empty state
  readonly noAchievementsMessage: Locator;

  /**
   * Every content locator scopes to <main>. React streams the pre-hydration
   * tree into a hidden `<div id="S:0">` that sits outside <main>, so until
   * hydration finishes both copies are in the DOM. Unscoped locators match
   * twice, strict mode throws, and the `.catch(() => false)` guards in the
   * specs swallow it - turning a gated assertion into a silent no-op.
   */
  private readonly content: Locator;

  constructor(page: Page) {
    super(page);

    this.content = page.getByRole("main");

    // Page heading. Pinned to level 1: the empty state renders an <h3> reading
    // "No achievements in this category", which also matches /achievements/i,
    // and two matches is a strict-mode throw rather than a failed assertion.
    this.pageHeading = this.content.getByRole("heading", { name: /achievements/i, level: 1 });

    // Stats cards - use title text
    this.totalProgressCard = this.content.getByText(/total progress/i);
    this.totalPointsCard = this.content.getByText(/total points/i);
    this.rarityBreakdownCard = this.content.getByText(/rarity breakdown/i);
    this.categoriesCard = this.content.getByText("Categories").first();

    // Category filter chips: <button aria-pressed> wrapping a Badge
    this.categoryChipAll = this.content.getByRole("button", {
      name: "All Achievements",
      exact: true,
    });

    // Achievement sections - one pair renders per category, so scope to the first
    this.completedHeading = this.content.getByRole("heading", { name: /completed/i }).first();
    this.inProgressHeading = this.content
      .getByRole("heading", {
        name: /in progress/i,
      })
      .first();

    // Card state labels: an unlocked card shows its tier name, a locked one
    // shows "Locked". Exact matching keeps "Locked" from also catching the
    // stats card's "12% unlocked".
    this.unlockedTierLabel = this.content.getByText(/^(Bronze|Silver|Gold|Platinum)$/).first();
    this.lockedCardLabel = this.content.getByText("Locked", { exact: true }).first();

    // Empty state, shown in place of the card grid
    this.noAchievementsMessage = this.content.getByText(/no achievements in this category/i);
  }

  /**
   * Assert that we're on the achievements page
   */
  async expectOnAchievementsPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/achievements/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Wait for the achievements data to render.
   *
   * The chip row is the marker: it renders for any resolved festival, with or
   * without cards. Neither the loading text nor the "select a festival" message
   * works here - both are showing while the festival context is still
   * resolving, so waiting on them returns during the initial render and every
   * assertion downstream then samples a page that has not loaded yet.
   */
  async waitForLoad(): Promise<void> {
    await expect(this.categoryChipAll).toBeVisible({ timeout: 15000 });
  }

  /**
   * Assert that the achievements page is fully loaded with data
   */
  async expectAchievementsLoaded(): Promise<void> {
    await this.expectOnAchievementsPage();
    await this.waitForLoad();
    await this.expectStatsVisible();
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
    return this.content.getByRole("button", { name: label, exact: true });
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
