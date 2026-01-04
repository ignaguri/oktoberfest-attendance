import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Sign Up page (/sign-up)
 * Handles user registration flows.
 */
export class SignUpPage extends BasePage {
  readonly path = "/sign-up";

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;

  // OAuth buttons
  readonly googleButton: Locator;
  readonly facebookButton: Locator;

  // Navigation
  readonly signInLink: Locator;

  // Success state elements
  readonly successHeading: Locator;
  readonly verificationMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel(/^email$/i);
    this.passwordInput = page.getByLabel(/^password$/i);
    this.confirmPasswordInput = page.getByLabel(/confirm password/i);
    this.submitButton = page.getByRole("button", { name: /submit/i });

    // OAuth buttons
    this.googleButton = page.getByRole("button", {
      name: /continue with google/i,
    });
    this.facebookButton = page.getByRole("button", {
      name: /continue with facebook/i,
    });

    // Navigation link to sign in (use the specific "Already have an account?" link)
    this.signInLink = page.getByRole("link", {
      name: /already have an account/i,
    });

    // Success state after account creation
    this.successHeading = page.getByRole("heading", { name: /account created/i });
    this.verificationMessage = page.getByText(/check your email/i);
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
   * Fill in the confirm password field
   */
  async fillConfirmPassword(confirmPassword: string): Promise<void> {
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  /**
   * Click the submit button
   */
  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete sign-up flow with email and matching passwords
   */
  async signUp(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(password);
    await this.clickSubmit();
  }

  /**
   * Complete sign-up flow with mismatched passwords (for error testing)
   */
  async signUpWithMismatchedPasswords(
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(confirmPassword);
    await this.clickSubmit();
  }

  /**
   * Assert that the sign-up form is visible
   */
  async expectFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Assert that we're on the sign-up page
   */
  async expectOnSignUpPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/sign-up/);
    await this.expectFormVisible();
  }

  /**
   * Assert that account was created successfully
   */
  async expectAccountCreated(): Promise<void> {
    await expect(this.successHeading).toBeVisible({ timeout: 10000 });
    await expect(this.verificationMessage).toBeVisible();
  }

  /**
   * Assert that an error message is shown (via toast or inline)
   */
  async expectSignUpError(message?: string | RegExp): Promise<void> {
    const toast = this.getToast();
    await expect(toast).toBeVisible();
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  /**
   * Assert that a validation error is shown for a specific field
   */
  async expectFieldError(errorText: string | RegExp): Promise<void> {
    const error = this.page.getByText(errorText);
    await expect(error).toBeVisible();
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitButtonDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  /**
   * Navigate to sign-in page via link
   */
  async goToSignIn(): Promise<void> {
    await this.signInLink.click();
    await this.page.waitForURL(/\/sign-in/);
  }
}
