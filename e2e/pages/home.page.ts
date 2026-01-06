import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page object for the Home page (/home)
 * Main dashboard with quick attendance, groups overview, and highlights.
 */
export class HomePage extends BasePage {
  readonly path = "/home";

  // Main sections
  readonly quickAttendanceSection: Locator;
  readonly myGroupsSection: Locator;
  readonly highlightsSection: Locator;
  readonly activityFeedSection: Locator;

  // Quick attendance elements
  readonly tentSelector: Locator;
  readonly beerCountButtons: Locator;
  readonly registerButton: Locator;
  readonly beerDecrementButton: Locator;
  readonly beerIncrementButton: Locator;
  readonly beerCountDisplay: Locator;

  // Navigation elements
  readonly navbar: Locator;
  readonly userMenuButton: Locator;

  constructor(page: Page) {
    super(page);

    // Main sections - using test ids or common patterns
    this.quickAttendanceSection = page
      .locator("[data-testid='quick-attendance']")
      .or(page.getByRole("region", { name: /attendance/i }));
    this.myGroupsSection = page
      .locator("[data-testid='my-groups']")
      .or(page.getByRole("region", { name: /groups/i }));
    this.highlightsSection = page
      .locator("[data-testid='highlights']")
      .or(page.getByRole("region", { name: /highlights/i }));
    this.activityFeedSection = page
      .locator("[data-testid='activity-feed']")
      .or(page.getByRole("region", { name: /activity/i }));

    // Quick attendance - the combobox has "Select your current tent" text
    this.tentSelector = page.getByRole("combobox");
    this.beerCountButtons = page.locator("[data-testid='beer-count-btn']");
    this.registerButton = page.getByRole("button", {
      name: /register|check.?in/i,
    });

    // Beer count buttons - find buttons adjacent to the beer count text
    // The structure is: [button -] [text "X drank today"] [button +]
    this.beerCountDisplay = page.getByText(/\d+ 🍺 drank today/);
    // Use locator relative to the parent container of beer count
    this.beerDecrementButton = this.beerCountDisplay
      .locator("..")
      .locator("button")
      .first();
    this.beerIncrementButton = this.beerCountDisplay
      .locator("..")
      .locator("button")
      .last();

    // Navigation
    this.navbar = page.getByRole("navigation");
    // User menu button contains the user's initials (U1-U10) and name
    this.userMenuButton = page
      .locator("[data-testid='user-menu']")
      .or(page.getByRole("button", { name: /User \d+/i }));
  }

  /**
   * Assert that we're on the home page
   */
  async expectOnHomePage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/home/);
  }

  /**
   * Assert that the home page is fully loaded
   */
  async expectHomePageLoaded(): Promise<void> {
    await this.expectOnHomePage();
    // Wait for key content to be visible
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Click on a navigation link
   */
  async navigateTo(linkName: string | RegExp): Promise<void> {
    await this.page.getByRole("link", { name: linkName }).click();
  }

  /**
   * Navigate to groups page
   */
  async goToGroups(): Promise<void> {
    await this.navigateTo(/groups/i);
    await this.page.waitForURL(/\/groups/);
  }

  /**
   * Navigate to attendance page
   */
  async goToAttendance(): Promise<void> {
    await this.navigateTo(/attendance/i);
    await this.page.waitForURL(/\/attendance/);
  }

  /**
   * Navigate to leaderboard page
   */
  async goToLeaderboard(): Promise<void> {
    await this.navigateTo(/leaderboard/i);
    await this.page.waitForURL(/\/leaderboard/);
  }

  /**
   * Navigate to profile page
   */
  async goToProfile(): Promise<void> {
    await this.navigateTo(/profile/i);
    await this.page.waitForURL(/\/profile/);
  }

  /**
   * Navigate to calendar page
   */
  async goToCalendar(): Promise<void> {
    await this.navigateTo(/calendar/i);
    await this.page.waitForURL(/\/calendar/);
  }

  /**
   * Open the user menu (avatar dropdown)
   */
  async openUserMenu(): Promise<void> {
    await this.userMenuButton.click();
  }

  /**
   * Sign out via user menu dropdown
   */
  async signOut(): Promise<void> {
    // Open the user menu dropdown
    await this.openUserMenu();

    // Wait for menu to appear and click sign out
    const signOutMenuItem = this.page.getByRole("menuitem", {
      name: /sign out/i,
    });
    await signOutMenuItem.click();
  }

  /**
   * Dismiss "What's New" dialog if visible
   */
  async dismissWhatsNewIfVisible(): Promise<void> {
    try {
      // Look for "Got it" button directly (more reliable than finding dialog first)
      const gotItButton = this.page.getByRole("button", { name: /^got it$/i });

      // Wait briefly for button to appear
      await gotItButton
        .waitFor({ state: "visible", timeout: 2000 })
        .catch(() => {});

      if (await gotItButton.isVisible().catch(() => false)) {
        await gotItButton.click({ force: true });
        await this.page.waitForTimeout(500);
      }
    } catch {
      // Dialog not present or already closed, continue
    }
  }

  /**
   * Dismiss tutorial modal if visible
   */
  async dismissTutorialIfVisible(): Promise<void> {
    try {
      // Look for the skip button directly
      const skipButton = this.page.getByRole("button", { name: /^skip$/i });

      // Wait briefly for button to appear
      await skipButton
        .waitFor({ state: "visible", timeout: 2000 })
        .catch(() => {});

      if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click({ force: true });
        await this.page.waitForTimeout(500);
      }
    } catch {
      // Tutorial not present, continue
    }
  }

  /**
   * Dismiss all overlays (What's New dialog and Tutorial)
   * Uses multiple attempts to ensure overlays are closed
   */
  async dismissAllOverlays(): Promise<void> {
    // Wait for page to settle after navigation
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000);

    // Try up to 3 times to dismiss all overlays
    for (let attempt = 0; attempt < 3; attempt++) {
      // Dismiss What's New dialog first (it appears on top)
      await this.dismissWhatsNewIfVisible();

      // Then dismiss tutorial
      await this.dismissTutorialIfVisible();

      // Check if any dialogs/overlays are still visible
      const hasGotIt = await this.page
        .getByRole("button", { name: /^got it$/i })
        .isVisible()
        .catch(() => false);
      const hasSkip = await this.page
        .getByRole("button", { name: /^skip$/i })
        .isVisible()
        .catch(() => false);

      if (!hasGotIt && !hasSkip) {
        break; // All overlays dismissed
      }

      // Small wait before retry
      await this.page.waitForTimeout(500);
    }

    // Final escape key press to close any remaining modals
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);
  }

  /**
   * Select a tent from the tent selector
   */
  async selectTent(tentNamePattern: RegExp | string): Promise<void> {
    await this.tentSelector.click();
    // Wait for dropdown to appear and click on the tent
    const tentOption = this.page.getByRole("option", { name: tentNamePattern });
    await tentOption.click();
  }

  /**
   * Get the current beer count from the display
   */
  async getBeerCount(): Promise<number> {
    const text = await this.beerCountDisplay.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Close any open dropdowns by pressing Escape
   */
  async closeDropdowns(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);
  }

  /**
   * Increment the beer count
   */
  async incrementBeerCount(): Promise<void> {
    // Close any open dropdowns first
    await this.closeDropdowns();
    await this.beerIncrementButton.click();
    // Wait for the form submission to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Decrement the beer count
   */
  async decrementBeerCount(): Promise<void> {
    // Close any open dropdowns first
    await this.closeDropdowns();
    await this.beerDecrementButton.click();
    // Wait for the form submission to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for beer count to update to a specific value
   */
  async expectBeerCount(count: number): Promise<void> {
    await expect(this.page.getByText(`${count} 🍺 drank today`)).toBeVisible();
  }
}
