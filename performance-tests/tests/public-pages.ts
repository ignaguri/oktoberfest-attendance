import puppeteer from "puppeteer";

import type { PerformanceReporter, PerformanceResult } from "../utils/reporter";
import type { Browser } from "puppeteer";

import {
  PUBLIC_SCENARIOS,
  DEVICE_CONFIGS,
  NETWORK_CONDITIONS,
} from "../config/test-scenarios";

const { default: lighthouse } = require("lighthouse");

export class PublicPageTests {
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
    console.log("🚀 Browser launched for public page tests");
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
   * Run all public page tests
   */
  async runAllTests(): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call setup() first.");
    }

    console.log("📱 Running public page performance tests...");

    for (const scenario of PUBLIC_SCENARIOS) {
      await this.testPublicPage(scenario);
    }
  }

  /**
   * Test a single public page with multiple device/network combinations
   */
  private async testPublicPage(
    scenario: (typeof PUBLIC_SCENARIOS)[0],
  ): Promise<void> {
    console.log(`\n🧪 Testing: ${scenario.name} (${scenario.url})`);

    // Test on mobile (primary focus)
    await this.runLighthouseTest(scenario, "mobile", "4G");

    // Test on desktop for comparison
    await this.runLighthouseTest(scenario, "desktop", "fast");

    // Test on 3G for slow network performance
    if (scenario.mobileOptimized) {
      await this.runLighthouseTest(scenario, "mobile", "3G");
    }
  }

  /**
   * Run Lighthouse test for a specific configuration
   */
  private async runLighthouseTest(
    scenario: (typeof PUBLIC_SCENARIOS)[0],
    deviceType: keyof typeof DEVICE_CONFIGS,
    networkType: keyof typeof NETWORK_CONDITIONS,
  ): Promise<void> {
    const testName = `${scenario.name} - ${deviceType} - ${networkType}`;
    console.log(`  📊 Running: ${testName}`);

    try {
      const page = await this.browser!.newPage();

      // Configure device emulation
      const device = DEVICE_CONFIGS[deviceType];
      await page.setUserAgent(device.userAgent);
      await page.setViewport(device.viewport);

      // Configure network throttling
      const network = NETWORK_CONDITIONS[networkType];
      const client = await page.target().createCDPSession();
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: (network.downloadThroughput * 1024) / 8, // Convert to bytes/s
        uploadThroughput: (network.uploadThroughput * 1024) / 8,
        latency: network.latency,
      });

      const url = `http://localhost:3000${scenario.url}`;

      // Run Lighthouse
      const lhResult = await lighthouse(url, {
        port: parseInt(new URL(this.browser!.wsEndpoint()).port),
        output: "json",
        logLevel: "error",
        disableStorageReset: false,
        throttling: {
          rttMs: network.latency,
          throughputKbps: network.downloadThroughput,
          cpuSlowdownMultiplier: deviceType === "mobile" ? 4 : 1,
        },
      });

      if (!lhResult) {
        throw new Error("Lighthouse returned null result");
      }

      // Extract metrics
      const audits = lhResult.lhr.audits;
      const metrics: PerformanceResult["metrics"] = {
        lcp: this.extractMetricValue(audits["largest-contentful-paint"]),
        fid: this.extractMetricValue(audits["first-input-delay"]),
        cls: this.extractMetricValue(audits["cumulative-layout-shift"]),
        fcp: this.extractMetricValue(audits["first-contentful-paint"]),
        si: this.extractMetricValue(audits["speed-index"]),
        tti: this.extractMetricValue(audits["interactive"]),
        tbt: this.extractMetricValue(audits["total-blocking-time"]),
        totalByteWeight: this.extractMetricValue(audits["total-byte-weight"]),
        pwaScore: lhResult.lhr.categories.pwa?.score
          ? Math.round(lhResult.lhr.categories.pwa.score * 100)
          : undefined,
      };

      // Check for errors/warnings
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if metrics exceed expected thresholds
      if (scenario.expectedMetrics) {
        if (
          metrics.lcp &&
          scenario.expectedMetrics.lcp &&
          metrics.lcp > scenario.expectedMetrics.lcp
        ) {
          warnings.push(
            `LCP ${metrics.lcp}ms exceeds target ${scenario.expectedMetrics.lcp}ms`,
          );
        }
        if (
          metrics.cls &&
          scenario.expectedMetrics.cls &&
          metrics.cls > scenario.expectedMetrics.cls
        ) {
          warnings.push(
            `CLS ${metrics.cls} exceeds target ${scenario.expectedMetrics.cls}`,
          );
        }
        if (
          metrics.tbt &&
          scenario.expectedMetrics.tbt &&
          metrics.tbt > scenario.expectedMetrics.tbt
        ) {
          warnings.push(
            `TBT ${metrics.tbt}ms exceeds target ${scenario.expectedMetrics.tbt}ms`,
          );
        }
      }

      // Create performance result
      const result: PerformanceResult = {
        testName,
        url,
        timestamp: new Date().toISOString(),
        device: `${deviceType} (${device.viewport.width}x${device.viewport.height})`,
        network: `${networkType} (${network.downloadThroughput}kbps)`,
        metrics,
        lighthouseScore: lhResult.lhr.categories.performance?.score
          ? Math.round(lhResult.lhr.categories.performance.score * 100)
          : undefined,
        errors,
        warnings,
      };

      this.reporter.addResult(result);

      await page.close();
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
    }
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
   * Test PWA capabilities specifically
   */
  async testPWAFeatures(): Promise<void> {
    console.log("\n🔧 Testing PWA features...");

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const page = await this.browser.newPage();

    try {
      // Test service worker registration
      await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });

      const swRegistered = await page.evaluate(async () => {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          return !!registration;
        }
        return false;
      });

      // Test manifest
      const manifestExists = await page.evaluate(() => {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        return !!manifestLink;
      });

      // Test offline capability
      await page.setOfflineMode(true);
      await page.reload({ waitUntil: "networkidle2" });

      const offlineWorks = await page.evaluate(() => {
        return (
          document.body.textContent?.includes("offline") ||
          document.body.textContent?.includes("Offline") ||
          !document.body.textContent?.includes("No Internet")
        );
      });

      await page.setOfflineMode(false);

      console.log(`  📱 Service Worker: ${swRegistered ? "✅" : "❌"}`);
      console.log(`  📄 Manifest: ${manifestExists ? "✅" : "❌"}`);
      console.log(`  🔌 Offline: ${offlineWorks ? "✅" : "❌"}`);
    } catch (error) {
      console.error("❌ PWA testing failed:", error);
    } finally {
      await page.close();
    }
  }

  /**
   * Run accessibility tests on public pages
   */
  async testAccessibility(): Promise<void> {
    console.log("\n♿ Testing accessibility...");

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    for (const scenario of PUBLIC_SCENARIOS) {
      const page = await this.browser.newPage();

      try {
        await page.goto(`http://localhost:3000${scenario.url}`, {
          waitUntil: "networkidle2",
        });

        // Run Lighthouse accessibility audit
        const lhResult = await lighthouse(
          `http://localhost:3000${scenario.url}`,
          {
            port: parseInt(new URL(this.browser.wsEndpoint()).port),
            output: "json",
            onlyCategories: ["accessibility"],
            logLevel: "error",
          },
        );

        if (lhResult?.lhr.categories.accessibility?.score) {
          const score = Math.round(
            lhResult.lhr.categories.accessibility.score * 100,
          );
          console.log(
            `  ${scenario.name}: ${score}/100 ${score >= 90 ? "✅" : score >= 70 ? "⚠️" : "❌"}`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Accessibility test failed for ${scenario.name}:`,
          error,
        );
      } finally {
        await page.close();
      }
    }
  }
}
