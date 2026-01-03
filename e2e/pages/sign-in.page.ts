import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

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
   * Fill in the email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill in the password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Click the sign in button
   */
  async clickSignIn(): Promise<void> {
    await this.signInButton.click();
  }

  /**
   * Complete sign-in flow with email and password
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  /**
   * Sign in and wait for successful redirect to home
   */
  async signInAndWaitForHome(email: string, password: string): Promise<void> {
    await this.signIn(email, password);
    await this.page.waitForURL(/\/home/);
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
}
