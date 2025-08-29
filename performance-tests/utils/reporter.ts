import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export interface PerformanceResult {
  testName: string;
  url: string;
  timestamp: string;
  device: string;
  network: string;
  metrics: {
    // Core Web Vitals
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift

    // Other Performance Metrics
    fcp?: number; // First Contentful Paint
    si?: number; // Speed Index
    tti?: number; // Time to Interactive
    tbt?: number; // Total Blocking Time

    // PWA Metrics
    pwaScore?: number;

    // Custom Metrics
    loadTime?: number;
    domContentLoaded?: number;
    networkRequests?: number;
    totalByteWeight?: number;
  };
  lighthouseScore?: number;
  screenshots?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface TestSuiteResult {
  suiteName: string;
  timestamp: string;
  duration: number;
  results: PerformanceResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    avgLCP: number;
    avgCLS: number;
    avgTBT: number;
    avgLighthouseScore: number;
  };
}

export class PerformanceReporter {
  private results: PerformanceResult[] = [];
  private reportsDir: string;

  constructor(reportsDir = "performance-tests/reports") {
    this.reportsDir = reportsDir;
    this.ensureReportsDir();
  }

  private ensureReportsDir(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Add a test result
   */
  addResult(result: PerformanceResult): void {
    this.results.push(result);
    console.log(
      `📊 Test completed: ${result.testName} - LCP: ${result.metrics.lcp}ms, CLS: ${result.metrics.cls}, TBT: ${result.metrics.tbt}ms`,
    );
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(): TestSuiteResult["summary"] {
    const validResults = this.results.filter(
      (r) => r.metrics.lcp !== undefined,
    );

    return {
      totalTests: this.results.length,
      passed: this.results.filter((r) => !r.errors || r.errors.length === 0)
        .length,
      failed: this.results.filter((r) => r.errors && r.errors.length > 0)
        .length,
      avgLCP: this.average(validResults.map((r) => r.metrics.lcp!)),
      avgCLS: this.average(validResults.map((r) => r.metrics.cls!)),
      avgTBT: this.average(validResults.map((r) => r.metrics.tbt!)),
      avgLighthouseScore: this.average(
        validResults.map((r) => r.lighthouseScore!).filter(Boolean),
      ),
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return (
      Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) /
      100
    );
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(suiteName: string, startTime: Date): string {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const suiteResult: TestSuiteResult = {
      suiteName,
      timestamp: new Date().toISOString(),
      duration,
      results: this.results,
      summary: this.generateSummary(),
    };

    const html = this.generateHtmlContent(suiteResult);
    const filename = `performance-report-${Date.now()}.html`;
    const filePath = join(this.reportsDir, filename);

    writeFileSync(filePath, html);
    console.log(`📄 HTML report generated: ${filePath}`);

    return filePath;
  }

  /**
   * Generate JSON report
   */
  generateJsonReport(suiteName: string, startTime: Date): string {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const suiteResult: TestSuiteResult = {
      suiteName,
      timestamp: new Date().toISOString(),
      duration,
      results: this.results,
      summary: this.generateSummary(),
    };

    const filename = `performance-data-${Date.now()}.json`;
    const filePath = join(this.reportsDir, filename);

    writeFileSync(filePath, JSON.stringify(suiteResult, null, 2));
    console.log(`📊 JSON data exported: ${filePath}`);

    return filePath;
  }

  private generateHtmlContent(suiteResult: TestSuiteResult): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProstCounter Performance Report</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #F59E0B; }
        .metric-card h3 { color: #D97706; margin-bottom: 10px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .metric-card .value { font-size: 2rem; font-weight: bold; color: #333; }
        .metric-card .unit { font-size: 1rem; color: #666; margin-left: 5px; }
        .results-table { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .results-table h2 { background: #F9FAFB; padding: 20px; margin: 0; border-bottom: 2px solid #E5E7EB; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F9FAFB; padding: 15px; text-align: left; font-weight: 600; border-bottom: 2px solid #E5E7EB; }
        td { padding: 15px; border-bottom: 1px solid #E5E7EB; }
        .status-pass { color: #10B981; font-weight: bold; }
        .status-warn { color: #F59E0B; font-weight: bold; }
        .status-fail { color: #EF4444; font-weight: bold; }
        .metric-good { color: #10B981; font-weight: bold; }
        .metric-ok { color: #F59E0B; font-weight: bold; }
        .metric-bad { color: #EF4444; font-weight: bold; }
        .footer { margin-top: 40px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍻 ProstCounter Performance Report</h1>
            <p>Generated on ${new Date(suiteResult.timestamp).toLocaleString()} | Duration: ${Math.round(suiteResult.duration / 1000)}s</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <h3>Tests Run</h3>
                <div class="value">${suiteResult.summary.totalTests}</div>
            </div>
            <div class="metric-card">
                <h3>Success Rate</h3>
                <div class="value">${Math.round((suiteResult.summary.passed / suiteResult.summary.totalTests) * 100)}<span class="unit">%</span></div>
            </div>
            <div class="metric-card">
                <h3>Avg LCP</h3>
                <div class="value ${this.getMetricClass(suiteResult.summary.avgLCP, 2500, 4000)}">${suiteResult.summary.avgLCP}<span class="unit">ms</span></div>
            </div>
            <div class="metric-card">
                <h3>Avg CLS</h3>
                <div class="value ${this.getMetricClass(suiteResult.summary.avgCLS, 0.1, 0.25)}">${suiteResult.summary.avgCLS}</div>
            </div>
            <div class="metric-card">
                <h3>Avg TBT</h3>
                <div class="value ${this.getMetricClass(suiteResult.summary.avgTBT, 200, 600)}">${suiteResult.summary.avgTBT}<span class="unit">ms</span></div>
            </div>
            <div class="metric-card">
                <h3>Avg Lighthouse</h3>
                <div class="value ${this.getMetricClass(suiteResult.summary.avgLighthouseScore, 90, 70)}">${suiteResult.summary.avgLighthouseScore || "N/A"}</div>
            </div>
        </div>

        <div class="results-table">
            <h2>📋 Detailed Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Device</th>
                        <th>LCP (ms)</th>
                        <th>CLS</th>
                        <th>TBT (ms)</th>
                        <th>Lighthouse</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${suiteResult.results
                      .map(
                        (result) => `
                        <tr>
                            <td><strong>${result.testName}</strong><br><small>${result.url}</small></td>
                            <td>${result.device}</td>
                            <td class="${this.getMetricClass(result.metrics.lcp!, 2500, 4000)}">${result.metrics.lcp || "N/A"}</td>
                            <td class="${this.getMetricClass(result.metrics.cls!, 0.1, 0.25)}">${result.metrics.cls || "N/A"}</td>
                            <td class="${this.getMetricClass(result.metrics.tbt!, 200, 600)}">${result.metrics.tbt || "N/A"}</td>
                            <td class="${this.getMetricClass(result.lighthouseScore!, 90, 70)}">${result.lighthouseScore || "N/A"}</td>
                            <td class="${result.errors && result.errors.length > 0 ? "status-fail" : "status-pass"}">
                                ${result.errors && result.errors.length > 0 ? "❌ Failed" : "✅ Passed"}
                            </td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Generated by ProstCounter Performance Testing Suite</p>
            <p>Core Web Vitals: LCP &lt; 2.5s (Good), &lt; 4s (Needs Improvement) | CLS &lt; 0.1 (Good), &lt; 0.25 (Needs Improvement)</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getMetricClass(
    value: number,
    goodThreshold: number,
    badThreshold: number,
  ): string {
    if (value === undefined || value === null) return "";

    if (value <= goodThreshold) return "metric-good";
    if (value <= badThreshold) return "metric-ok";
    return "metric-bad";
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.generateSummary();

    console.log("\n" + "=".repeat(60));
    console.log("🍻 PROSTCOUNTER PERFORMANCE TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`📊 Tests Run: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(
      `📈 Success Rate: ${Math.round((summary.passed / summary.totalTests) * 100)}%`,
    );
    console.log("");
    console.log("🎯 Core Web Vitals Averages:");
    console.log(
      `   LCP: ${summary.avgLCP}ms ${this.getStatusEmoji(summary.avgLCP, 2500, 4000)}`,
    );
    console.log(
      `   CLS: ${summary.avgCLS} ${this.getStatusEmoji(summary.avgCLS, 0.1, 0.25)}`,
    );
    console.log(
      `   TBT: ${summary.avgTBT}ms ${this.getStatusEmoji(summary.avgTBT, 200, 600)}`,
    );

    if (summary.avgLighthouseScore > 0) {
      console.log(`🏆 Avg Lighthouse Score: ${summary.avgLighthouseScore}`);
    }
    console.log("=".repeat(60) + "\n");
  }

  private getStatusEmoji(
    value: number,
    goodThreshold: number,
    badThreshold: number,
  ): string {
    if (value <= goodThreshold) return "🟢";
    if (value <= badThreshold) return "🟡";
    return "🔴";
  }

  /**
   * Clear all results (for new test run)
   */
  clearResults(): void {
    this.results = [];
  }
}
