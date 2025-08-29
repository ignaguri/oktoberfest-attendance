import type { Page } from "puppeteer";

import { TEST_USER } from "../config/test-scenarios";

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Sign in using the test user credentials
   */
  async signIn(): Promise<void> {
    try {
      console.log("🔐 Attempting to sign in...");

      // Navigate to sign-in page
      await this.page.goto("http://localhost:3000/sign-in", {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for the form to load
      await this.page.waitForSelector('input[name="email"]', {
        timeout: 10000,
      });
      await this.page.waitForSelector('input[name="password"]', {
        timeout: 10000,
      });

      // Clear any existing content and fill in credentials
      await this.page.click('input[name="email"]', { clickCount: 3 });
      await this.page.type('input[name="email"]', TEST_USER.email);

      await this.page.click('input[name="password"]', { clickCount: 3 });
      await this.page.type('input[name="password"]', TEST_USER.password);

      // Submit the form and wait for navigation (authentication can be slow)
      const navigationPromise = this.page.waitForNavigation({
        waitUntil: "domcontentloaded", // More reliable than networkidle0
        timeout: 30000, // Increased timeout for slow auth
      });

      await this.page.click('button[type="submit"]');
      await navigationPromise;

      // Check if we're successfully authenticated by checking the URL
      const currentUrl = this.page.url();
      console.log(`📍 Current URL after sign-in: ${currentUrl}`);

      if (currentUrl.includes("/sign-in") || currentUrl.includes("/auth")) {
        throw new Error("Authentication failed - still on sign-in page");
      }

      // Wait for page to be stable
      await this.waitForPageStable();

      // Additional verification - try to access a protected route
      await this.page.goto("http://localhost:3000/home", {
        waitUntil: "networkidle0",
        timeout: 15000,
      });

      const homeUrl = this.page.url();
      if (homeUrl.includes("/sign-in") || homeUrl.includes("/auth")) {
        throw new Error(
          "Authentication verification failed - cannot access protected route",
        );
      }

      console.log("✅ Successfully signed in as test user");
    } catch (error) {
      console.error("❌ Sign-in failed:", error);
      // Take a screenshot for debugging
      try {
        await this.page.screenshot({
          path: `performance-tests/reports/screenshots/signin-error-${Date.now()}.png`,
          fullPage: true,
        });
      } catch (screenshotError) {
        console.error("Failed to take error screenshot:", screenshotError);
      }
      throw error;
    }
  }

  /**
   * Check if the user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for elements that indicate authentication
      const authIndicators = [
        '[data-testid="user-menu"]',
        ".user-avatar",
        '[data-testid="sign-out"]',
        'nav[role="navigation"]',
      ];

      for (const selector of authIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Sign out if authenticated
   */
  async signOut(): Promise<void> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        console.log("ℹ️  User is not authenticated, skipping sign out");
        return;
      }

      // Try different sign-out methods
      const signOutSelectors = [
        '[data-testid="sign-out"]',
        '[data-testid="user-menu"]', // Click user menu first
        'button[data-action="sign-out"]',
        'a[href*="sign-out"]',
      ];

      let signedOut = false;
      for (const selector of signOutSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          if (selector.includes("user-menu")) {
            // Click user menu to open dropdown
            await element.click();
            await this.page
              .waitForFunction(() => true, { timeout: 500 })
              .catch(() => {});

            // Now look for sign out option in dropdown
            const signOutInDropdown = await this.page.$(
              '[data-testid="sign-out"], a[href*="sign-out"]',
            );
            if (signOutInDropdown) {
              await signOutInDropdown.click();
              signedOut = true;
              break;
            }
          } else {
            await element.click();
            signedOut = true;
            break;
          }
        }
      }

      if (signedOut) {
        // Wait for redirect to sign-in or home page
        await this.page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 10000,
        });
        console.log("✅ Successfully signed out");
      } else {
        console.warn("⚠️  Could not find sign-out button");
      }
    } catch (error) {
      console.error("❌ Failed to sign out:", error);
    }
  }

  /**
   * Clear all browser data (cookies, localStorage, sessionStorage)
   */
  async clearBrowserData(): Promise<void> {
    try {
      // Clear cookies
      const cookies = await this.page.cookies();
      if (cookies.length > 0) {
        await this.page.deleteCookie(...cookies);
      }

      // Clear localStorage and sessionStorage
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      console.log("✅ Browser data cleared");
    } catch (error) {
      console.error("❌ Failed to clear browser data:", error);
    }
  }

  /**
   * Setup fresh authentication state for testing
   */
  async setupFreshSession(): Promise<void> {
    await this.clearBrowserData();
    await this.signIn();
  }

  /**
   * Wait for page to be fully loaded and stable
   */
  async waitForPageStable(): Promise<void> {
    // Wait for network to be idle
    await this.page
      .waitForNavigation({ waitUntil: "networkidle2" })
      .catch(() => {});

    // Wait a bit more for any animations or async operations
    await this.page
      .waitForFunction(() => true, { timeout: 1000 })
      .catch(() => {});

    // Check if there are any ongoing network requests
    await this.page
      .waitForFunction(
        () => {
          // @ts-ignore - performance is available in browser context
          return performance.getEntriesByType("navigation").length > 0;
        },
        { timeout: 5000 },
      )
      .catch(() => {});
  }

  /**
   * Navigate to an authenticated page and ensure it loads properly
   */
  async navigateToAuthenticatedPage(path: string): Promise<void> {
    const fullUrl = `http://localhost:3000${path}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Attempt ${attempt}/${maxRetries}: Navigating to ${path}`,
        );

        await this.page.goto(fullUrl, {
          waitUntil: "domcontentloaded", // More reliable than networkidle0
          timeout: 30000,
        });

        // Check if we got redirected to sign-in (not authenticated)
        const currentUrl = this.page.url();
        console.log(`📍 Current URL: ${currentUrl}`);

        if (currentUrl.includes("/sign-in") || currentUrl.includes("/auth")) {
          if (attempt < maxRetries) {
            console.log(
              `⚠️  Redirected to auth page, re-authenticating (attempt ${attempt}/${maxRetries})`,
            );
            await this.signIn();
            continue;
          } else {
            throw new Error(
              "Redirected to authentication page - user not authenticated after retries",
            );
          }
        }

        await this.waitForPageStable();
        console.log(`✅ Successfully navigated to ${path}`);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(
            `❌ Failed to navigate to ${path} after ${maxRetries} attempts:`,
            error,
          );
          // Take a screenshot for debugging
          try {
            await this.page.screenshot({
              path: `performance-tests/reports/screenshots/nav-error-${path.replace("/", "")}-${Date.now()}.png`,
              fullPage: true,
            });
          } catch (screenshotError) {
            console.error("Failed to take error screenshot:", screenshotError);
          }
          throw error;
        }
        console.log(`⚠️  Attempt ${attempt} failed, retrying...`);
        await this.page
          .waitForFunction(() => true, { timeout: 2000 })
          .catch(() => {}); // Wait before retry
      }
    }
  }
}
