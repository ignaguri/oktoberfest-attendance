import puppeteer from "puppeteer";

import type { PerformanceReporter, PerformanceResult } from "../utils/reporter";
import type { Browser, Page } from "puppeteer";

import { AuthHelper } from "../utils/auth-helper";
import { NavigationHelper } from "../utils/navigation";

const { default: lighthouse } = require("lighthouse");

export class MobilePerformanceTests {
  private browser: Browser | null = null;
  private reporter: PerformanceReporter;

  constructor(reporter: PerformanceReporter) {
    this.reporter = reporter;
  }

  /**
   * Initialize browser for mobile testing
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
    console.log("📱 Browser launched for mobile performance tests");
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
   * Run comprehensive mobile performance tests
   */
  async runMobileTests(): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call setup() first.");
    }

    console.log("📱 Running mobile-specific performance tests...");

    // Test different mobile devices
    await this.testDifferentDevices();

    // Test mobile network conditions
    await this.testNetworkConditions();

    // Test mobile interactions
    await this.testMobileInteractions();

    // Test image loading on mobile
    await this.testImagePerformance();

    // Test PWA mobile features
    await this.testPWAMobileFeatures();
  }

  /**
   * Test on different mobile device configurations
   */
  private async testDifferentDevices(): Promise<void> {
    console.log("\n📱 Testing different mobile devices...");

    const mobileDevices = [
      {
        name: "iPhone SE",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
      },
      {
        name: "iPhone 12 Pro",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
      {
        name: "Samsung Galaxy S21",
        userAgent:
          "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
      },
      {
        name: "iPad Mini",
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
      },
    ];

    // Test home page on different devices
    for (const device of mobileDevices) {
      await this.testDevicePerformance(device);
    }
  }

  /**
   * Test performance on a specific device
   */
  private async testDevicePerformance(device: any): Promise<void> {
    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);

    try {
      // Configure device
      await page.setUserAgent(device.userAgent);
      await page.setViewport(device.viewport);

      // Test public page (landing)
      await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
      await this.measurePagePerformance(
        page,
        `Landing - ${device.name}`,
        device,
      );

      // Test authenticated page (home dashboard)
      await authHelper.signIn();
      await authHelper.navigateToAuthenticatedPage("/home");
      await this.measurePagePerformance(
        page,
        `Home Dashboard - ${device.name}`,
        device,
      );
    } catch (error) {
      console.error(`❌ Device test failed for ${device.name}:`, error);
    } finally {
      await page.close();
    }
  }

  /**
   * Test different network conditions on mobile
   */
  private async testNetworkConditions(): Promise<void> {
    console.log("\n🌐 Testing mobile network conditions...");

    const networkConditions = [
      {
        name: "Slow 3G",
        downloadThroughput: (500 * 1024) / 8,
        uploadThroughput: (500 * 1024) / 8,
        latency: 400,
      },
      {
        name: "Fast 3G",
        downloadThroughput: (1600 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        latency: 150,
      },
      {
        name: "4G",
        downloadThroughput: (9000 * 1024) / 8,
        uploadThroughput: (9000 * 1024) / 8,
        latency: 150,
      },
    ];

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);

    try {
      // Configure mobile device
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
      );
      await page.setViewport({ width: 375, height: 812 });

      for (const network of networkConditions) {
        console.log(`  🔄 Testing ${network.name}...`);

        const client = await page.target().createCDPSession();
        await client.send("Network.emulateNetworkConditions", {
          offline: false,
          downloadThroughput: network.downloadThroughput,
          uploadThroughput: network.uploadThroughput,
          latency: network.latency,
        });

        // Test critical pages under this network condition
        const testPages = [
          { url: "/", name: "Landing", requiresAuth: false },
          { url: "/home", name: "Home Dashboard", requiresAuth: true },
          { url: "/achievements", name: "Achievements", requiresAuth: true },
        ];

        for (const testPage of testPages) {
          try {
            if (testPage.requiresAuth) {
              if (!(await authHelper.isAuthenticated())) {
                await authHelper.signIn();
              }
              await authHelper.navigateToAuthenticatedPage(testPage.url);
            } else {
              await page.goto(`http://localhost:3000${testPage.url}`, {
                waitUntil: "networkidle2",
              });
            }

            await this.measurePagePerformance(
              page,
              `${testPage.name} - ${network.name}`,
              { name: `Mobile - ${network.name}` },
            );
          } catch (error) {
            console.error(
              `❌ Failed to test ${testPage.name} on ${network.name}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ Network conditions test failed:", error);
    } finally {
      await page.close();
    }
  }

  /**
   * Test mobile-specific interactions
   */
  private async testMobileInteractions(): Promise<void> {
    console.log("\n👆 Testing mobile interactions...");

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);
    const navHelper = new NavigationHelper(page);

    try {
      // Configure mobile device
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
      );
      await page.setViewport({ width: 375, height: 812 });

      await authHelper.signIn();
      await authHelper.navigateToAuthenticatedPage("/home");

      // Test touch interactions
      const interactionTests = [
        {
          name: "Quick Registration Touch",
          test: async () => {
            if (
              await navHelper.elementExists(
                '[data-testid="quick-register-btn"]',
              )
            ) {
              const startTime = Date.now();
              await page.touchscreen.tap(200, 400); // Approximate button location
              await page
                .waitForFunction(() => true, { timeout: 1000 })
                .catch(() => {});
              return Date.now() - startTime;
            }
            return null;
          },
        },
        {
          name: "Navigation Menu Touch",
          test: async () => {
            if (await navHelper.elementExists('[data-testid="user-menu"]')) {
              const startTime = Date.now();
              await navHelper.click('[data-testid="user-menu"]');
              await page
                .waitForFunction(() => true, { timeout: 500 })
                .catch(() => {});
              return Date.now() - startTime;
            }
            return null;
          },
        },
        {
          name: "Scroll Performance",
          test: async () => {
            const startTime = Date.now();
            // Simulate scroll gestures
            for (let i = 0; i < 5; i++) {
              await page.evaluate(() => window.scrollBy(0, 100));
              await page
                .waitForFunction(() => true, { timeout: 50 })
                .catch(() => {});
            }
            return Date.now() - startTime;
          },
        },
      ];

      for (const interactionTest of interactionTests) {
        try {
          const duration = await interactionTest.test();
          if (duration !== null) {
            console.log(`  ✅ ${interactionTest.name}: ${duration}ms`);

            // Record interaction performance
            const result: PerformanceResult = {
              testName: `Mobile Interaction: ${interactionTest.name}`,
              url: page.url(),
              timestamp: new Date().toISOString(),
              device: "Mobile Touch",
              network: "4G",
              metrics: {
                loadTime: duration,
              },
              warnings:
                duration > 1000
                  ? ["Interaction took longer than 1 second"]
                  : [],
            };

            this.reporter.addResult(result);
          }
        } catch (error) {
          console.error(`❌ ${interactionTest.name} failed:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Mobile interactions test failed:", error);
    } finally {
      await page.close();
    }
  }

  /**
   * Test image loading performance on mobile
   */
  private async testImagePerformance(): Promise<void> {
    console.log("\n🖼️ Testing mobile image performance...");

    const page = await this.browser!.newPage();
    const authHelper = new AuthHelper(page);

    try {
      // Configure mobile device with slow network
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
      );
      await page.setViewport({ width: 375, height: 812 });

      const client = await page.target().createCDPSession();
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: (1600 * 1024) / 8, // Fast 3G
        uploadThroughput: (750 * 1024) / 8,
        latency: 150,
      });

      // Test pages with heavy image content
      const imageHeavyPages = [
        {
          url: "/achievements",
          name: "Achievements (badges)",
          requiresAuth: true,
        },
        // Note: Would test gallery pages if we had test data with images
      ];

      for (const testPage of imageHeavyPages) {
        try {
          if (testPage.requiresAuth) {
            await authHelper.signIn();
            await authHelper.navigateToAuthenticatedPage(testPage.url);
          } else {
            await page.goto(`http://localhost:3000${testPage.url}`, {
              waitUntil: "networkidle2",
            });
          }

          // Wait for images to load
          await page
            .waitForFunction(() => true, { timeout: 3000 })
            .catch(() => {});

          // Check for lazy loading implementation
          const lazyImages = await page.$$eval(
            'img[loading="lazy"]',
            (imgs) => imgs.length,
          );

          // Measure image loading performance
          const imageMetrics = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll("img"));
            const totalImages = images.length;
            const loadedImages = images.filter((img) => img.complete).length;

            return {
              totalImages,
              loadedImages,
              loadedPercentage:
                totalImages > 0 ? (loadedImages / totalImages) * 100 : 100,
            };
          });

          console.log(`  📊 ${testPage.name}:`);
          console.log(`    Total images: ${imageMetrics.totalImages}`);
          console.log(`    Loaded images: ${imageMetrics.loadedImages}`);
          console.log(`    Lazy loading images: ${lazyImages}`);
          console.log(
            `    Load success rate: ${imageMetrics.loadedPercentage.toFixed(1)}%`,
          );

          const result: PerformanceResult = {
            testName: `Mobile Image Loading: ${testPage.name}`,
            url: page.url(),
            timestamp: new Date().toISOString(),
            device: "Mobile - Fast 3G",
            network: "Fast 3G",
            metrics: {
              networkRequests: imageMetrics.totalImages,
            },
            warnings:
              imageMetrics.loadedPercentage < 90
                ? ["Some images failed to load"]
                : [],
          };

          this.reporter.addResult(result);
        } catch (error) {
          console.error(`❌ Image test failed for ${testPage.name}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Image performance test failed:", error);
    } finally {
      await page.close();
    }
  }

  /**
   * Test PWA mobile features
   */
  private async testPWAMobileFeatures(): Promise<void> {
    console.log("\n📱 Testing PWA mobile features...");

    const page = await this.browser!.newPage();

    try {
      // Configure mobile device
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
      );
      await page.setViewport({ width: 375, height: 812 });

      await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });

      // Test PWA features
      const pwaFeatures = await page.evaluate(async () => {
        const features: {
          serviceWorker: boolean;
          manifest: boolean;
          https: boolean;
          responsive: boolean;
          serviceWorkerActive?: boolean;
        } = {
          serviceWorker: "serviceWorker" in navigator,
          manifest: !!document.querySelector('link[rel="manifest"]'),
          https: location.protocol === "https:",
          responsive: window.innerWidth <= 768,
        };

        // Test service worker registration
        if (features.serviceWorker) {
          try {
            const registration = await navigator.serviceWorker.ready;
            features.serviceWorkerActive = !!registration.active;
          } catch {
            features.serviceWorkerActive = false;
          }
        }

        return features;
      });

      // Test offline functionality
      await page.setOfflineMode(true);
      await page.reload({ waitUntil: "domcontentloaded" });

      const offlineContent = await page.content();
      const offlineWorks =
        !offlineContent.includes("ERR_INTERNET_DISCONNECTED") &&
        offlineContent.length > 1000;

      await page.setOfflineMode(false);

      console.log("  📱 PWA Features:");
      console.log(
        `    Service Worker: ${pwaFeatures.serviceWorker ? "✅" : "❌"}`,
      );
      console.log(
        `    Service Worker Active: ${pwaFeatures.serviceWorkerActive ? "✅" : "❌"}`,
      );
      console.log(`    Manifest: ${pwaFeatures.manifest ? "✅" : "❌"}`);
      console.log(`    Responsive: ${pwaFeatures.responsive ? "✅" : "❌"}`);
      console.log(`    Offline Support: ${offlineWorks ? "✅" : "❌"}`);

      const pwaScore = [
        pwaFeatures.serviceWorker,
        pwaFeatures.serviceWorkerActive,
        pwaFeatures.manifest,
        pwaFeatures.responsive,
        offlineWorks,
      ].filter(Boolean).length;

      const result: PerformanceResult = {
        testName: "PWA Mobile Features",
        url: "http://localhost:3000/",
        timestamp: new Date().toISOString(),
        device: "Mobile",
        network: "4G",
        metrics: {
          pwaScore: (pwaScore / 5) * 100,
        },
        warnings: pwaScore < 4 ? ["PWA features not fully implemented"] : [],
      };

      this.reporter.addResult(result);
    } catch (error) {
      console.error("❌ PWA mobile features test failed:", error);
    } finally {
      await page.close();
    }
  }

  /**
   * Measure page performance metrics
   */
  private async measurePagePerformance(
    page: Page,
    testName: string,
    device: any,
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Wait for page to be fully loaded
      await page
        .waitForNavigation({ waitUntil: "networkidle2" })
        .catch(() => {});

      const loadTime = Date.now() - startTime;

      // Get performance metrics from browser
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType("paint");

        const fcp = paint.find(
          (entry) => entry.name === "first-contentful-paint",
        )?.startTime;
        const lcp = paint.find(
          (entry) => entry.name === "largest-contentful-paint",
        )?.startTime;

        return {
          domContentLoaded: navigation
            ? navigation.domContentLoadedEventEnd -
              navigation.domContentLoadedEventStart
            : 0,
          loadComplete: navigation
            ? navigation.loadEventEnd - navigation.loadEventStart
            : 0,
          fcp: fcp ? Math.round(fcp) : undefined,
          lcp: lcp ? Math.round(lcp) : undefined,
        };
      });

      // Run Lighthouse for additional metrics
      const lhResult = await lighthouse(page.url(), {
        port: parseInt(new URL(this.browser!.wsEndpoint()).port),
        output: "json",
        logLevel: "error",
        formFactor: "mobile",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
      });

      const result: PerformanceResult = {
        testName,
        url: page.url(),
        timestamp: new Date().toISOString(),
        device: device.name || "Mobile Device",
        network: "4G",
        metrics: {
          loadTime,
          domContentLoaded: Math.round(metrics.domContentLoaded),
          fcp: metrics.fcp,
          lcp: this.extractMetricValue(
            lhResult?.lhr.audits["largest-contentful-paint"],
          ),
          cls: this.extractMetricValue(
            lhResult?.lhr.audits["cumulative-layout-shift"],
          ),
          tbt: this.extractMetricValue(
            lhResult?.lhr.audits["total-blocking-time"],
          ),
        },
        lighthouseScore: lhResult?.lhr.categories.performance?.score
          ? Math.round(lhResult.lhr.categories.performance.score * 100)
          : undefined,
      };

      this.reporter.addResult(result);
    } catch (error) {
      console.error(
        `❌ Performance measurement failed for ${testName}:`,
        error,
      );
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
}
