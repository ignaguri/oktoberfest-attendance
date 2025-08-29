import type { FlowStep } from "../config/test-scenarios";
import type { Page } from "puppeteer";

export class NavigationHelper {
  constructor(private page: Page) {}

  /**
   * Execute a flow step (click, type, navigate, etc.)
   */
  async executeStep(step: FlowStep): Promise<void> {
    console.log(`Executing: ${step.description}`);

    try {
      switch (step.action) {
        case "navigate":
          await this.navigate(step.target!);
          break;
        case "click":
          await this.click(step.target!);
          break;
        case "type":
          await this.type(step.target!, step.value!);
          break;
        case "wait":
          await this.wait(step.waitTime || 1000);
          break;
        case "upload":
          await this.uploadFile(step.target!, step.value!);
          break;
        case "scroll":
          await this.scroll(step.target!, parseInt(step.value || "0"));
          break;
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      // Small delay after each step to ensure stability
      await this.page
        .waitForFunction(() => true, { timeout: 500 })
        .catch(() => {});
    } catch (error) {
      console.error(`Failed to execute step "${step.description}":`, error);
      throw error;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    const fullUrl = url.startsWith("http")
      ? url
      : `http://localhost:3000${url}`;
    await this.page.goto(fullUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.click(selector);
  }

  /**
   * Type into an input field
   */
  async type(selector: string, text: string): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: 10000 });

    // Clear existing content
    await this.page.click(selector, { clickCount: 3 });
    await this.page.keyboard.press("Backspace");

    // Type new content
    await this.page.type(selector, text);
  }

  /**
   * Wait for a specified time
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page
      .waitForFunction(() => true, { timeout: milliseconds })
      .catch(() => {});
  }

  /**
   * Upload a file
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: 10000 });
    const input = (await this.page.$(selector)) as any;
    if (input) {
      await input.uploadFile(filePath);
    } else {
      throw new Error(`File input not found: ${selector}`);
    }
  }

  /**
   * Scroll the page
   */
  async scroll(selector: string, pixels: number): Promise<void> {
    if (selector === "body") {
      await this.page.evaluate((px) => window.scrollBy(0, px), pixels);
    } else {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.evaluate(
        (sel, px) => {
          const element = document.querySelector(sel);
          if (element) {
            element.scrollTop += px;
          }
        },
        selector,
        pixels,
      );
    }

    // Wait for scroll to complete and any lazy loading
    await this.page
      .waitForFunction(() => true, { timeout: 1000 })
      .catch(() => {});
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { visible: true, timeout });
  }

  /**
   * Check if an element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get text content of an element
   */
  async getElementText(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.$eval(
      selector,
      (el) => el.textContent?.trim() || "",
    );
  }

  /**
   * Take a screenshot
   */
  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({
      path: path as any,
      fullPage: true,
    });
  }

  /**
   * Wait for page to be fully loaded (no pending requests)
   */
  async waitForPageLoad(): Promise<void> {
    await this.page
      .waitForNavigation({ waitUntil: "networkidle2" })
      .catch(() => {});

    // Additional wait for React hydration and any async operations
    await this.page
      .waitForFunction(() => true, { timeout: 2000 })
      .catch(() => {});
  }

  /**
   * Simulate mobile device interactions
   */
  async simulateMobileInteraction(): Promise<void> {
    // Simulate touch interactions
    await this.page.touchscreen?.tap?.(200, 300).catch(() => {});
    await this.page
      .waitForFunction(() => true, { timeout: 100 })
      .catch(() => {});
  }

  /**
   * Check for and handle any error modals or alerts
   */
  async handleErrorModals(): Promise<void> {
    const errorSelectors = [
      '[data-testid="error-modal"]',
      ".error-message",
      '[role="alert"]',
      ".toast-error",
    ];

    for (const selector of errorSelectors) {
      const errorElement = await this.page.$(selector);
      if (errorElement) {
        const errorText = await errorElement.evaluate((el) => el.textContent);
        console.warn(`⚠️  Error modal detected: ${errorText}`);

        // Try to close the modal
        const closeButton = await this.page.$(
          `${selector} button, ${selector} [data-testid="close"]`,
        );
        if (closeButton) {
          await closeButton.click();
        }
      }
    }
  }

  /**
   * Monitor console errors during navigation
   */
  enableConsoleMonitoring(): void {
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("Browser console error:", msg.text());
      }
    });

    this.page.on("pageerror", (error) => {
      console.error("Page error:", error.message);
    });

    this.page.on("requestfailed", (request) => {
      console.error(
        "Request failed:",
        request.url(),
        request.failure()?.errorText,
      );
    });
  }
}
