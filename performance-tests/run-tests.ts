#!/usr/bin/env tsx

import { AuthenticatedFlowTests } from "./tests/authenticated-flows";
import { MobilePerformanceTests } from "./tests/mobile-performance";
import { PublicPageTests } from "./tests/public-pages";
import { PerformanceReporter } from "./utils/reporter";

interface TestSuiteOptions {
  publicPages?: boolean;
  authenticatedFlows?: boolean;
  mobileTests?: boolean;
  includeAccessibility?: boolean;
  includePWA?: boolean;
}

class PerformanceTestRunner {
  private reporter: PerformanceReporter;

  constructor() {
    this.reporter = new PerformanceReporter();
  }

  /**
   * Run all performance tests
   */
  async runAllTests(options: TestSuiteOptions = {}): Promise<void> {
    const {
      publicPages = true,
      authenticatedFlows = true,
      mobileTests = true,
      includeAccessibility = true,
      includePWA = true,
    } = options;

    console.log("🍻 Starting ProstCounter Performance Test Suite");
    console.log("================================================");

    const startTime = new Date();
    let totalErrors = 0;

    try {
      // Check if dev server is running
      await this.checkDevServer();

      if (publicPages) {
        console.log("\n📄 Running Public Page Tests...");
        const publicTests = new PublicPageTests(this.reporter);

        try {
          await publicTests.setup();
          await publicTests.runAllTests();

          if (includeAccessibility) {
            await publicTests.testAccessibility();
          }

          if (includePWA) {
            await publicTests.testPWAFeatures();
          }

          await publicTests.cleanup();
          console.log("✅ Public page tests completed");
        } catch (error) {
          console.error("❌ Public page tests failed:", error);
          totalErrors++;
        }
      }

      if (authenticatedFlows) {
        console.log("\n🔐 Running Authenticated Flow Tests...");
        const flowTests = new AuthenticatedFlowTests(this.reporter);

        try {
          await flowTests.setup();
          await flowTests.runAuthenticatedPageTests();
          await flowTests.runUserFlowTests();
          await flowTests.testFestivalSwitching();
          await flowTests.cleanup();
          console.log("✅ Authenticated flow tests completed");
        } catch (error) {
          console.error("❌ Authenticated flow tests failed:", error);
          totalErrors++;
        }
      }

      if (mobileTests) {
        console.log("\n📱 Running Mobile Performance Tests...");
        const mobileTests = new MobilePerformanceTests(this.reporter);

        try {
          await mobileTests.setup();
          await mobileTests.runMobileTests();
          await mobileTests.cleanup();
          console.log("✅ Mobile performance tests completed");
        } catch (error) {
          console.error("❌ Mobile performance tests failed:", error);
          totalErrors++;
        }
      }

      // Generate reports
      console.log("\n📊 Generating Performance Reports...");

      const htmlReportPath = this.reporter.generateHtmlReport(
        "ProstCounter Performance Tests",
        startTime,
      );
      const jsonReportPath = this.reporter.generateJsonReport(
        "ProstCounter Performance Tests",
        startTime,
      );

      // Print summary
      this.reporter.printSummary();

      // Final status
      const endTime = new Date();
      const totalDuration = Math.round(
        (endTime.getTime() - startTime.getTime()) / 1000,
      );

      console.log(`\n🎉 Test suite completed in ${totalDuration}s`);
      console.log(`📄 HTML Report: ${htmlReportPath}`);
      console.log(`📊 JSON Data: ${jsonReportPath}`);

      if (totalErrors > 0) {
        console.log(
          `\n⚠️  ${totalErrors} test suite(s) had errors - check logs above`,
        );
        process.exit(1);
      } else {
        console.log("\n🎊 All tests completed successfully!");
      }
    } catch (error) {
      console.error("💥 Test runner failed:", error);
      process.exit(1);
    }
  }

  /**
   * Run only public page tests (good for CI/CD)
   */
  async runPublicTests(): Promise<void> {
    await this.runAllTests({
      publicPages: true,
      authenticatedFlows: false,
      mobileTests: false,
      includeAccessibility: true,
      includePWA: true,
    });
  }

  /**
   * Run only authenticated tests
   */
  async runAuthenticatedTests(): Promise<void> {
    await this.runAllTests({
      publicPages: false,
      authenticatedFlows: true,
      mobileTests: false,
    });
  }

  /**
   * Run mobile-focused tests
   */
  async runMobileTests(): Promise<void> {
    await this.runAllTests({
      publicPages: false,
      authenticatedFlows: false,
      mobileTests: true,
    });
  }

  /**
   * Check if development server is running
   */
  private async checkDevServer(): Promise<void> {
    try {
      const response = await fetch("http://localhost:3000/");
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      console.log("✅ Development server is running");
    } catch (error) {
      console.error(
        "❌ Development server is not accessible at http://localhost:3000",
      );
      console.error("   Please run: pnpm dev");
      throw new Error("Development server not running");
    }
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || "all";

  const runner = new PerformanceTestRunner();

  switch (command) {
    case "all":
    case "full":
      runner.runAllTests();
      break;

    case "public":
      runner.runPublicTests();
      break;

    case "auth":
    case "authenticated":
      runner.runAuthenticatedTests();
      break;

    case "mobile":
      runner.runMobileTests();
      break;

    default:
      console.log("🍻 ProstCounter Performance Test Runner");
      console.log("");
      console.log("Usage:");
      console.log("  pnpm perf:test [command]");
      console.log("");
      console.log("Commands:");
      console.log("  all, full    - Run all tests (default)");
      console.log("  public       - Run only public page tests");
      console.log("  auth         - Run only authenticated flow tests");
      console.log("  mobile       - Run only mobile performance tests");
      console.log("");
      console.log("Examples:");
      console.log("  pnpm perf:test");
      console.log("  pnpm perf:test mobile");
      console.log("  pnpm perf:test public");
      process.exit(0);
  }
}

export { PerformanceTestRunner };
