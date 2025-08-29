/**
 * Lighthouse configuration for ProstCounter performance testing
 */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
    },
  },
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
  },
  audits: [
    // Core Web Vitals
    "largest-contentful-paint",
    "first-input-delay",
    "cumulative-layout-shift",

    // Performance
    "first-contentful-paint",
    "speed-index",
    "interactive",
    "total-blocking-time",

    // PWA specific
    "service-worker",
    "installable-manifest",
    "splash-screen",
    "themed-omnibox",
    "viewport",

    // Accessibility (for form performance)
    "color-contrast",
    "form-field-multiple-labels",
    "button-name",

    // Best practices for images/uploads
    "image-aspect-ratio",
    "image-size-responsive",
    "offscreen-images",
    "render-blocking-resources",

    // Network/Bundle size
    "unused-javascript",
    "legacy-javascript",
    "total-byte-weight",
  ],
  categories: {
    performance: {
      title: "Performance",
      weight: 1,
    },
    pwa: {
      title: "Progressive Web App",
      weight: 1,
    },
  },
};
