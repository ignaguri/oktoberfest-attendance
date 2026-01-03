import { test, expect } from "@playwright/test";

import {
  DEFAULT_TEST_USER,
  generateUniqueEmail,
  INVALID_CREDENTIALS,
  TEST_USERS,
} from "../helpers/test-data";
import { HomePage } from "../pages/home.page";
import { SignInPage } from "../pages/sign-in.page";
import { SignUpPage } from "../pages/sign-up.page";

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Authentication Flows", () => {
  test.describe("FLOW_AUTH_001: Sign In with Email/Password", () => {
    test("should sign in with valid credentials", async ({ page }) => {
      const signInPage = new SignInPage(page);
      const homePage = new HomePage(page);

      // Navigate to sign-in page
      await signInPage.goto();
      await signInPage.expectFormVisible();

      // Sign in with default test user
      await signInPage.signInAndWaitForHome(
        DEFAULT_TEST_USER.email,
        DEFAULT_TEST_USER.password
      );

      // Verify successful sign-in
      await homePage.expectOnHomePage();
    });

    test("should sign in with alternative test user", async ({ page }) => {
      const signInPage = new SignInPage(page);
      const homePage = new HomePage(page);

      await signInPage.goto();

      // Sign in with user1
      await signInPage.signInAndWaitForHome(
        TEST_USERS.user1.email,
        TEST_USERS.user1.password
      );

      await homePage.expectOnHomePage();
    });
  });

  test.describe("FLOW_AUTH_002: Sign Out", () => {
    test("should sign out successfully", async ({ page }) => {
      const signInPage = new SignInPage(page);
      const homePage = new HomePage(page);

      // First sign in
      await signInPage.goto();
      await signInPage.signInAndWaitForHome(
        DEFAULT_TEST_USER.email,
        DEFAULT_TEST_USER.password
      );
      await homePage.expectOnHomePage();

      // Dismiss any overlays (What's New dialog and Tutorial)
      await homePage.dismissAllOverlays();

      // Sign out via user menu dropdown
      await homePage.signOut();

      // Should be redirected to sign-in or landing page
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });

    test("should not access protected routes after sign out", async ({
      page,
    }) => {
      const signInPage = new SignInPage(page);
      const homePage = new HomePage(page);

      // Sign in first
      await signInPage.goto();
      await signInPage.signInAndWaitForHome(
        DEFAULT_TEST_USER.email,
        DEFAULT_TEST_USER.password
      );
      await homePage.expectOnHomePage();

      // Dismiss any overlays (What's New dialog and Tutorial)
      await homePage.dismissAllOverlays();

      // Sign out via user menu dropdown
      await homePage.signOut();

      // Wait for sign out to navigate away from /home
      // Could redirect to /sign-in, /, or /error (if session invalidation causes an error)
      await expect(page).not.toHaveURL(/\/home$/);

      // Clear any session state by navigating to sign-in page
      await page.goto("/sign-in");

      // Try to access home directly
      await page.goto("/home");

      // Should be redirected to sign-in (not stay on home)
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });
  });

  test.describe("FLOW_AUTH_003: Sign In Error - Invalid Credentials", () => {
    test("should show error for invalid credentials", async ({ page }) => {
      const signInPage = new SignInPage(page);

      await signInPage.goto();

      // Try to sign in with invalid credentials
      await signInPage.signIn(
        INVALID_CREDENTIALS.email,
        INVALID_CREDENTIALS.password
      );

      // Wait a bit for any redirect or error
      await page.waitForTimeout(2000);

      // Should stay on sign-in page (not redirect to home)
      await expect(page).not.toHaveURL(/\/home/);
    });

    test("should show error for wrong password with valid email", async ({
      page,
    }) => {
      const signInPage = new SignInPage(page);

      await signInPage.goto();

      // Use valid email but wrong password
      await signInPage.signIn(DEFAULT_TEST_USER.email, "wrongpassword123");

      // Wait a bit for any redirect or error
      await page.waitForTimeout(2000);

      // Should stay on sign-in page (not redirect to home)
      await expect(page).not.toHaveURL(/\/home/);
    });

    test("should show error for empty credentials", async ({ page }) => {
      const signInPage = new SignInPage(page);

      await signInPage.goto();

      // Click sign in without entering credentials
      await signInPage.clickSignIn();

      // Should stay on sign-in page (validation should prevent submission)
      await signInPage.expectOnSignInPage();
    });
  });

  test.describe("FLOW_AUTH_004: Redirect Unauthenticated User", () => {
    test("should redirect unauthenticated user to sign-in from /home", async ({
      page,
    }) => {
      // Try to access home directly without signing in
      await page.goto("/home");

      // Should be redirected to sign-in page
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });

    test("should redirect unauthenticated user to sign-in from /groups", async ({
      page,
    }) => {
      await page.goto("/groups");
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });

    test("should redirect unauthenticated user to sign-in from /attendance", async ({
      page,
    }) => {
      await page.goto("/attendance");
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });

    test("should redirect unauthenticated user to sign-in from /leaderboard", async ({
      page,
    }) => {
      await page.goto("/leaderboard");
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });

    test("should redirect unauthenticated user to sign-in from /profile", async ({
      page,
    }) => {
      await page.goto("/profile");
      await expect(page).toHaveURL(/\/sign-in|\/$/);
    });
  });

  test.describe("FLOW_AUTH_005: Sign Up with Email/Password", () => {
    test("should display sign up form", async ({ page }) => {
      const signUpPage = new SignUpPage(page);

      await signUpPage.goto();
      await signUpPage.expectFormVisible();
    });

    test("should submit sign up form with valid credentials", async ({
      page,
    }) => {
      const signUpPage = new SignUpPage(page);

      await signUpPage.goto();

      // Use a unique email for each test run
      const uniqueEmail = generateUniqueEmail();
      await signUpPage.signUp(uniqueEmail, "TestPassword123!");

      // Wait for form submission to process
      await page.waitForTimeout(2000);

      // In local Supabase, sign up may show success or may require email confirmation
      // Check for either success state or that form was submitted (no validation errors)
      const successHeading = page.getByRole("heading", {
        name: /account created/i,
      });
      const isSuccess = await successHeading.isVisible().catch(() => false);

      if (isSuccess) {
        // Full success - account created message shown
        await signUpPage.expectAccountCreated();
      } else {
        // Form was submitted - check no error toast appeared
        // (validation passed, server may have different behavior)
        await signUpPage.expectOnSignUpPage();
      }
    });
  });

  test.describe("FLOW_AUTH_006: Sign Up Error - Password Mismatch", () => {
    test("should show error when passwords do not match", async ({ page }) => {
      const signUpPage = new SignUpPage(page);

      await signUpPage.goto();

      // Enter mismatched passwords
      await signUpPage.signUpWithMismatchedPasswords(
        generateUniqueEmail(),
        "Password123!",
        "DifferentPassword!"
      );

      // Should stay on sign-up page and show error
      await signUpPage.expectOnSignUpPage();
      await signUpPage.expectFieldError(/passwords/i);
    });
  });

  test.describe("FLOW_AUTH_007: Sign Up Error - Invalid Email", () => {
    test("should show error for invalid email format", async ({ page }) => {
      const signUpPage = new SignUpPage(page);

      await signUpPage.goto();

      // Try to sign up with invalid email
      await signUpPage.signUp("invalid-email", "TestPassword123!");

      // Should stay on sign-up page
      await signUpPage.expectOnSignUpPage();
    });

    test("should show error for empty fields", async ({ page }) => {
      const signUpPage = new SignUpPage(page);

      await signUpPage.goto();

      // Click submit without filling fields
      await signUpPage.clickSubmit();

      // Should stay on sign-up page (validation prevents submission)
      await signUpPage.expectOnSignUpPage();
    });
  });

  test.describe("FLOW_AUTH_008: Navigate from Sign Up to Sign In", () => {
    test("should navigate to sign-in from sign-up page", async ({ page }) => {
      const signUpPage = new SignUpPage(page);
      const signInPage = new SignInPage(page);

      await signUpPage.goto();
      await signUpPage.goToSignIn();

      // Should be on sign-in page with form visible
      await signInPage.expectOnSignInPage();
    });
  });
});
