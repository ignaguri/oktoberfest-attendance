import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/image/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Optimize string serialization in webpack
    config.optimization = {
      ...config.optimization,
      moduleIds: "deterministic",
    };

    // Exclude large type definitions from the bundle
    if (!isServer) {
      config.module.rules.push({
        test: /database\.types\.ts$/,
        use: ["babel-loader"],
        sideEffects: false,
      });
    }

    return config;
  },
};

const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "prostcounter",
  project: "prost-counter",
  sentryUrl: "https://sentry.io/",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

const revision = crypto.randomUUID();
// Initialize Serwist with configuration
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});

// Export the config with Serwist and Sentry wrappers
export default withSentryConfig(withSerwist(nextConfig), sentryConfig);
