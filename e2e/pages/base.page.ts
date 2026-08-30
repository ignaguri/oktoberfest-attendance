import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BASE_URL } from "../helpers/config";

/**
 * Base page class that all page objects extend.
 * Provides common navigation and utility methods.
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * The path for this page (e.g., "/sign-in", "/home")
   */
  abstract readonly path: string;

  /**
   * Navigate to this page
   */
  async goto(): Promise<void> {
    await this.page.goto(`${BASE_URL}${this.path}`);
  }

  /**
   * Navigate to this page with query parameters
   */
  async gotoWithParams(params: Record<string, string>): Promise<void> {
    const searchParams = new URLSearchParams(params);
    await this.page.goto(`${BASE_URL}${this.path}?${searchParams.toString()}`);
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern: RegExp): Promise<void> {
    await this.page.waitForURL(urlPattern);
  }

  /**
   * Get toast notification locator (Sonner toast)
   */
  getToast(): Locator {
    return this.page.locator("[data-sonner-toast]");
  }

  /**
   * Assert toast contains specific message
   */
  async expectToastMessage(message: string | RegExp): Promise<void> {
    await expect(this.getToast()).toContainText(message);
  }

  /**
   * Assert toast is visible with success styling
   */
  async expectSuccessToast(message?: string | RegExp): Promise<void> {
    const toast = this.getToast();
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  /**
   * Assert toast is visible with error styling
   */
  async expectErrorToast(message?: string | RegExp): Promise<void> {
    const toast = this.getToast();
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  /**
   * Click a navigation link by name
   */
  async clickNavLink(name: string | RegExp): Promise<void> {
    await this.page.getByRole("link", { name }).click();
  }

  /**
   * Click a button by name
   */
  async clickButton(name: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  /**
   * Assert current URL matches pattern
   */
  async expectUrl(urlPattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(urlPattern);
  }

  /**
   * Assert page title contains text
   */
  async expectPageTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png` });
  }

  /**
   * Wait for hCaptcha to issue a token.
   *
   * The always-pass test sitekey needs no interaction, but the iframe still has
   * to load and post the token back into the hidden textarea. Submitting before
   * that sends an empty token and GoTrue rejects it.
   *
   * No-op when the widget is absent, so this stays safe in any environment
   * where NEXT_PUBLIC_HCAPTCHA_SITEKEY is unset and no widget renders.
   */
  async waitForCaptcha(): Promise<void> {
    const widget = this.page.locator("textarea[name='h-captcha-response']");

    const isPresent = await widget
      .first()
      .waitFor({ state: "attached", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!isPresent) {
      return;
    }

    await this.page.waitForFunction(
      () => {
        const input = document.querySelector<HTMLTextAreaElement>(
          "textarea[name='h-captcha-response']",
        );
        return Boolean(input?.value);
      },
      undefined,
      { timeout: 15000 },
    );
  }
}
