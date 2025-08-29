import puppeteer from "puppeteer";

import type { PerformanceReporter, PerformanceResult } from "../utils/reporter";
import type { Browser, Page } from "puppeteer";

import {
  AUTHENTICATED_SCENARIOS,
  AUTHENTICATED_FLOWS,
  DEVICE_CONFIGS,
  NETWORK_CONDITIONS,
} from "../config/test-scenarios";
import { AuthHelper } from "../utils/auth-helper";
import { NavigationHelper } from "../utils/navigation";

const { default: lighthouse } = require("lighthouse");

export class AuthenticatedFlowTests {
  private browser: Browser | null = null;
  private reporter: PerformanceReporter;

  constructor(reporter: PerformanceReporter) {
    this.reporter = reporter;
  }

  /**
   * Initialize browser for testing
   */
  async setup(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    });
    console.log("🚀 Browser launched for authenticated flow tests");
  }

  /**
   * Clean up browser
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log("🔒 Browser closed");
    }
  }

  /**
   * Run all authenticated page tests
   */
  async runAuthenticatedPageTests(): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call setup() first.");
    }

    console.log("🔐 Running authenticated page performance tests...");

    for (const scenario of AUTHENTICATED_SCENARIOS) {
      await this.testAuthenticatedPage(scenario);
    }
  }

  /**
   * Run all authenticated user flow tests
   */
  async runUserFlowTests(): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call setup() first.");
    }

    console.log("🔄 Running authenticated user flow tests...");

    for (const flow of AUTHENTICATED_FLOWS) {
      await this.testUserFlow(flow);
    }
  }

  /**
   * Test a single authenticated page
   */
  private async testAuthenticatedPage(
    scenario: (typeof AUTHENTICATED_SCENARIOS)[0],
  ): Promise<void> {
    console.log(`\n🧪 Testing: ${scenario.name} (${scenario.url})`);

    // Test on mobile (primary focus)
    await this.runAuthenticatedPageTest(scenario, "mobile", "4G");

    // Test on desktop for comparison
    await this.runAuthenticatedPageTest(scenario, "desktop", "fast");
  }

  /**
   * Run authenticated page test with specific configuration
   */
  private async runAuthenticatedPageTest(
    scenario: (typeof AUTHENTICATED_SCENARIOS)[0],
    deviceType: keyof typeof DEVICE_CONFIGS,
    networkType: keyof typeof NETWORK_CONDITIONS,
  ): Promise<void> {
    const testName = `${scenario.name} - ${deviceType} - ${networkType}`;
    console.log(`  📊 Running: ${testName}`);

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);
    const navHelper = new NavigationHelper(page);

    try {
      // Configure device emulation
      const device = DEVICE_CONFIGS[deviceType];
      await page.setUserAgent(device.userAgent);
      await page.setViewport(device.viewport);

      // Configure network throttling
      const network = NETWORK_CONDITIONS[networkType];
      const client = await page.target().createCDPSession();
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: (network.downloadThroughput * 1024) / 8,
        uploadThroughput: (network.uploadThroughput * 1024) / 8,
        latency: network.latency,
      });

      // Enable console monitoring
      navHelper.enableConsoleMonitoring();

      // Authenticate user
      await authHelper.signIn();

      // Navigate to the target page
      const startTime = Date.now();
      await authHelper.navigateToAuthenticatedPage(scenario.url);
      const loadTime = Date.now() - startTime;

      // Wait for page to stabilize
      await authHelper.waitForPageStable();

      // Take screenshot for debugging
      const screenshotPath = `performance-tests/reports/screenshots/${testName.replace(/\s+/g, "_")}.png`;
      await navHelper.screenshot(screenshotPath);

      // Run Lighthouse on the authenticated page
      const url = `http://localhost:3000${scenario.url}`;
      const lhResult = await lighthouse(url, {
        port: parseInt(new URL(this.browser!.wsEndpoint()).port),
        output: "json",
        logLevel: "error",
        disableStorageReset: true, // Don't reset storage (preserves auth)
      });

      // Extract metrics
      const metrics: PerformanceResult["metrics"] = {
        loadTime,
        lcp: this.extractMetricValue(
          lhResult?.lhr.audits["largest-contentful-paint"],
        ),
        fid: this.extractMetricValue(lhResult?.lhr.audits["first-input-delay"]),
        cls: this.extractMetricValue(
          lhResult?.lhr.audits["cumulative-layout-shift"],
        ),
        fcp: this.extractMetricValue(
          lhResult?.lhr.audits["first-contentful-paint"],
        ),
        tti: this.extractMetricValue(lhResult?.lhr.audits["interactive"]),
        tbt: this.extractMetricValue(
          lhResult?.lhr.audits["total-blocking-time"],
        ),
      };

      // Test specific page interactions
      const interactionErrors = await this.testPageInteractions(page, scenario);

      // Check for performance issues
      const warnings = this.checkPerformanceThresholds(
        metrics,
        scenario.expectedMetrics,
      );

      const result: PerformanceResult = {
        testName,
        url,
        timestamp: new Date().toISOString(),
        device: `${deviceType} (${device.viewport.width}x${device.viewport.height})`,
        network: `${networkType} (${network.downloadThroughput}kbps)`,
        metrics,
        lighthouseScore: lhResult?.lhr.categories.performance?.score
          ? Math.round(lhResult.lhr.categories.performance.score * 100)
          : undefined,
        screenshots: [screenshotPath],
        errors: interactionErrors,
        warnings,
      };

      this.reporter.addResult(result);
    } catch (error) {
      console.error(`❌ Test failed: ${testName}`, error);

      const result: PerformanceResult = {
        testName,
        url: `http://localhost:3000${scenario.url}`,
        timestamp: new Date().toISOString(),
        device: deviceType,
        network: networkType,
        metrics: {},
        errors: [`Test execution failed: ${error}`],
      };

      this.reporter.addResult(result);
    } finally {
      await page.close();
    }
  }

  /**
   * Test a complete user flow
   */
  private async testUserFlow(
    flow: (typeof AUTHENTICATED_FLOWS)[0],
  ): Promise<void> {
    console.log(`\n🔄 Testing Flow: ${flow.name}`);

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);
    const navHelper = new NavigationHelper(page);

    try {
      // Configure for mobile testing (primary target)
      const device = DEVICE_CONFIGS.mobile;
      await page.setUserAgent(device.userAgent);
      await page.setViewport(device.viewport);

      // Enable monitoring
      navHelper.enableConsoleMonitoring();

      const startTime = Date.now();
      const stepTimings: Array<{ step: string; duration: number }> = [];

      // Execute each step in the flow
      for (let index = 0; index < flow.steps.length; index++) {
        const step = flow.steps[index];
        const stepStart = Date.now();

        try {
          await navHelper.executeStep(step);

          // Handle error modals that might appear
          await navHelper.handleErrorModals();

          const stepDuration = Date.now() - stepStart;
          stepTimings.push({ step: step.description, duration: stepDuration });

          console.log(
            `    ✅ Step ${index + 1}: ${step.description} (${stepDuration}ms)`,
          );
        } catch (stepError) {
          console.error(
            `    ❌ Step ${index + 1} failed: ${step.description}`,
            stepError,
          );
          throw new Error(
            `Flow step failed: ${step.description} - ${stepError}`,
          );
        }
      }

      const totalDuration = Date.now() - startTime;

      // Take final screenshot
      const screenshotPath = `performance-tests/reports/screenshots/${flow.name.replace(/\s+/g, "_")}_final.png`;
      await navHelper.screenshot(screenshotPath);

      // Measure final page performance
      const finalUrl = page.url();
      const lhResult = await lighthouse(finalUrl, {
        port: parseInt(new URL(this.browser!.wsEndpoint()).port),
        output: "json",
        logLevel: "error",
        disableStorageReset: true,
      });

      const metrics: PerformanceResult["metrics"] = {
        loadTime: totalDuration,
        lcp: this.extractMetricValue(
          lhResult?.lhr.audits["largest-contentful-paint"],
        ),
        cls: this.extractMetricValue(
          lhResult?.lhr.audits["cumulative-layout-shift"],
        ),
        tbt: this.extractMetricValue(
          lhResult?.lhr.audits["total-blocking-time"],
        ),
      };

      const warnings = this.checkPerformanceThresholds(
        metrics,
        flow.expectedMetrics,
      );

      const result: PerformanceResult = {
        testName: `Flow: ${flow.name}`,
        url: finalUrl,
        timestamp: new Date().toISOString(),
        device: "Mobile Flow Test",
        network: "4G",
        metrics,
        screenshots: [screenshotPath],
        warnings,
      };

      this.reporter.addResult(result);

      console.log(`  ✅ Flow completed in ${totalDuration}ms`);
      stepTimings.forEach((timing) => {
        console.log(`    • ${timing.step}: ${timing.duration}ms`);
      });
    } catch (error) {
      console.error(`❌ Flow test failed: ${flow.name}`, error);

      const result: PerformanceResult = {
        testName: `Flow: ${flow.name}`,
        url: page.url(),
        timestamp: new Date().toISOString(),
        device: "Mobile Flow Test",
        network: "4G",
        metrics: {},
        errors: [`Flow execution failed: ${error}`],
      };

      this.reporter.addResult(result);
    } finally {
      await page.close();
    }
  }

  /**
   * Test page-specific interactions
   */
  private async testPageInteractions(
    page: Page,
    scenario: (typeof AUTHENTICATED_SCENARIOS)[0],
  ): Promise<string[]> {
    const errors: string[] = [];
    const navHelper = new NavigationHelper(page);

    try {
      switch (scenario.name) {
        case "Home Dashboard":
          // Test quick beer registration
          if (
            await navHelper.elementExists('[data-testid="quick-register-btn"]')
          ) {
            await navHelper.click('[data-testid="quick-register-btn"]');
            await page
              .waitForFunction(() => true, { timeout: 1000 })
              .catch(() => {});
          }
          break;

        case "Attendance Tracking":
          // Test date picker and form interactions
          if (await navHelper.elementExists('[data-testid="date-picker"]')) {
            await navHelper.click('[data-testid="date-picker"]');
            await page
              .waitForFunction(() => true, { timeout: 500 })
              .catch(() => {});
          }
          break;

        case "Achievements":
          // Test achievement card interactions and scrolling
          await navHelper.scroll("body", 500);
          await page
            .waitForFunction(() => true, { timeout: 1000 })
            .catch(() => {});

          if (
            await navHelper.elementExists('[data-testid="achievement-card"]')
          ) {
            await navHelper.click('[data-testid="achievement-card"]');
            await page
              .waitForFunction(() => true, { timeout: 1000 })
              .catch(() => {});
          }
          break;

        case "Groups Management":
          // Test group list and join functionality
          if (await navHelper.elementExists('[data-testid="join-group-btn"]')) {
            await navHelper.click('[data-testid="join-group-btn"]');
            await page
              .waitForFunction(() => true, { timeout: 500 })
              .catch(() => {});
          }
          break;

        case "Global Leaderboard":
          // Test leaderboard scrolling and filtering
          await navHelper.scroll("body", 300);
          await page
            .waitForFunction(() => true, { timeout: 1000 })
            .catch(() => {});
          break;
      }
    } catch (error) {
      errors.push(`Interaction test failed: ${error}`);
    }

    return errors;
  }

  /**
   * Check performance against expected thresholds
   */
  private checkPerformanceThresholds(
    metrics: PerformanceResult["metrics"],
    expected?: (typeof AUTHENTICATED_SCENARIOS)[0]["expectedMetrics"],
  ): string[] {
    const warnings: string[] = [];

    if (!expected) return warnings;

    if (metrics.lcp && expected.lcp && metrics.lcp > expected.lcp) {
      warnings.push(`LCP ${metrics.lcp}ms exceeds target ${expected.lcp}ms`);
    }

    if (metrics.cls && expected.cls && metrics.cls > expected.cls) {
      warnings.push(`CLS ${metrics.cls} exceeds target ${expected.cls}`);
    }

    if (metrics.tbt && expected.tbt && metrics.tbt > expected.tbt) {
      warnings.push(`TBT ${metrics.tbt}ms exceeds target ${expected.tbt}ms`);
    }

    return warnings;
  }

  /**
   * Extract numeric value from Lighthouse audit
   */
  private extractMetricValue(audit: any): number | undefined {
    if (!audit) return undefined;

    if (typeof audit.numericValue === "number") {
      return Math.round(audit.numericValue);
    }

    if (typeof audit.displayValue === "string") {
      const match = audit.displayValue.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : undefined;
    }

    return undefined;
  }

  /**
   * Test festival switching performance specifically
   */
  async testFestivalSwitching(): Promise<void> {
    console.log("\n🎪 Testing festival switching performance...");

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);
    const navHelper = new NavigationHelper(page);

    try {
      // Authenticate and go to home
      await authHelper.signIn();
      await authHelper.navigateToAuthenticatedPage("/home");

      // Measure festival switch performance
      const switches = [
        {
          from: "Current",
          to: "2024",
          selector: '[data-testid="festival-option-2024"]',
        },
        {
          from: "2024",
          to: "2025",
          selector: '[data-testid="festival-option-2025"]',
        },
      ];

      for (const switchTest of switches) {
        try {
          const startTime = Date.now();

          // Open festival selector
          if (
            await navHelper.elementExists('[data-testid="festival-selector"]')
          ) {
            await navHelper.click('[data-testid="festival-selector"]');
            await page
              .waitForFunction(() => true, { timeout: 500 })
              .catch(() => {});

            // Switch festival
            if (await navHelper.elementExists(switchTest.selector)) {
              await navHelper.click(switchTest.selector);

              // Wait for data to reload
              await page
                .waitForFunction(() => true, { timeout: 3000 })
                .catch(() => {});
              await authHelper.waitForPageStable();

              const switchDuration = Date.now() - startTime;
              console.log(
                `  🔄 ${switchTest.from} → ${switchTest.to}: ${switchDuration}ms`,
              );

              // Record the performance
              const result: PerformanceResult = {
                testName: `Festival Switch: ${switchTest.from} to ${switchTest.to}`,
                url: page.url(),
                timestamp: new Date().toISOString(),
                device: "Mobile",
                network: "4G",
                metrics: {
                  loadTime: switchDuration,
                },
                warnings:
                  switchDuration > 5000
                    ? ["Festival switch took longer than 5 seconds"]
                    : [],
              };

              this.reporter.addResult(result);
            }
          }
        } catch (error) {
          console.error(
            `❌ Festival switch test failed (${switchTest.from} → ${switchTest.to}):`,
            error,
          );
        }
      }
    } catch (error) {
      console.error("❌ Festival switching test failed:", error);
    } finally {
      await page.close();
    }
  }
}
