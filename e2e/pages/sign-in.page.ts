import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BASE_URL } from "../helpers/config";
import { BasePage } from "./base.page";

/**
 * Page object for the Sign In page (/sign-in)
 * Handles user authentication flows.
 */
export class SignInPage extends BasePage {
  readonly path = "/sign-in";

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  // Alternative locators for different form states
  readonly form: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.signInButton = page.getByRole("button", { name: /sign in/i });
    this.form = page.locator("form");
  }

  /**
   * Wait for the sign-in form to be ready for interaction
   */
  async waitForFormReady(): Promise<void> {
    // Wait for page to be fully loaded
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for form elements to be visible and interactable
    await this.emailInput.waitFor({ state: "visible", timeout: 15000 });
    await this.passwordInput.waitFor({ state: "visible", timeout: 5000 });
    await this.signInButton.waitFor({ state: "visible", timeout: 5000 });

    // Ensure button is enabled (not in loading state)
    await expect(this.signInButton).toBeEnabled({ timeout: 5000 });
  }

  /**
   * Fill in the email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  /**
   * Fill in the password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
  }

  /**
   * Click the sign in button
   */
  async clickSignIn(): Promise<void> {
    // Ensure button is enabled before clicking
    await expect(this.signInButton).toBeEnabled({ timeout: 5000 });
    await this.signInButton.click();
  }

  /**
   * Complete sign-in flow with email and password
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.waitForFormReady();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  /**
   * Sign in and wait for successful redirect to home
   */
  async signInAndWaitForHome(email: string, password: string): Promise<void> {
    await this.signIn(email, password);

    // Wait for navigation to complete with longer timeout
    await this.page.waitForURL(/\/home/, {
      timeout: 30000,
      waitUntil: "domcontentloaded",
    });
  }

  /**
   * Assert that the sign-in form is visible
   */
  async expectFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Assert that we're on the sign-in page
   */
  async expectOnSignInPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/sign-in/);
    await this.expectFormVisible();
  }

  /**
   * Assert that an error message is shown (via toast)
   */
  async expectSignInError(message?: string | RegExp): Promise<void> {
    const toast = this.getToast();
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  /**
   * Check if sign-in button is disabled (e.g., during submission)
   */
  async isSignInButtonDisabled(): Promise<boolean> {
    return await this.signInButton.isDisabled();
  }

  /**
   * Navigate to sign-in page and ensure clean state
   */
  async gotoAndEnsureLoggedOut(): Promise<void> {
    await this.page.goto(`${BASE_URL}${this.path}`, {
      waitUntil: "domcontentloaded",
    });

    // Check if we were redirected to home (already logged in)
    const currentUrl = this.page.url();
    if (currentUrl.includes("/home")) {
      // Already logged in, need to sign out first
      const signOutLink = this.page.getByRole("menuitem", {
        name: /sign out/i,
      });
      const userMenuButton = this.page.getByRole("button", {
        name: /User \d+/i,
      });

      // Try to find and click user menu
      const hasUserMenu = await userMenuButton.isVisible().catch(() => false);
      if (hasUserMenu) {
        await userMenuButton.click();
        await signOutLink.click();
        await this.page.waitForURL(/\/sign-in|\/$/);
      }

      // Navigate back to sign-in
      await this.page.goto(`${BASE_URL}${this.path}`, {
        waitUntil: "domcontentloaded",
      });
    }

    // Wait for form to be ready
    await this.waitForFormReady();
  }
}
