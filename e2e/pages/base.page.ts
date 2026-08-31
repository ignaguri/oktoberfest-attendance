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
   * Solve hCaptcha and wait for it to issue a token.
   *
   * The widget renders as hCaptcha's default visible checkbox, which does
   * nothing until it is clicked. The always-pass test sitekey then completes
   * without showing a challenge, but it does not execute the widget by itself:
   * without the click the response field stays empty forever.
   *
   * No-op when no widget is on the page, so this stays safe wherever captcha
   * is not configured.
   */
  async waitForCaptcha(): Promise<void> {
    // Detected from the page, never from process.env. NEXT_PUBLIC_* values are
    // inlined into the bundle when the app is built, so what the Playwright
    // process sees says nothing about what the app under test was built with:
    // against a preview deploy the two disagree in either direction.
    //
    // The library injects its API script on mount, so this is present as soon
    // as the widget exists, and well before the iframe or response field are.
    const isConfigured = (await this.page.locator("script[src*='hcaptcha.com']").count()) > 0;

    if (!isConfigured) {
      return;
    }

    const response = this.page.locator("textarea[name='h-captcha-response']").first();

    // Deliberately not caught. If the script is on the page but the widget
    // never materialises, something is wrong with the captcha configuration
    // (a blocked host, a bad sitekey) and the run should say so loudly rather
    // than submit an empty token and fail later as "invalid credentials".
    await response.waitFor({ state: "attached", timeout: 15000 });

    // An invisible widget, or an earlier call, may have solved it already.
    if (await response.inputValue()) {
      return;
    }

    await this.page
      .frameLocator("iframe[title*='checkbox for hCaptcha']")
      .locator("#checkbox")
      .click();

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
