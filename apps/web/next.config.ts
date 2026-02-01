import { withSentryConfig } from "@sentry/nextjs";
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import type { NextConfig } from "next";

// Load .env.device if it exists (for physical device testing with local network IP)
// Using override: false so it only fills missing values, not override existing .env settings
const envDevicePath = join(__dirname, ".env.device");
if (existsSync(envDevicePath)) {
  config({ path: envDevicePath, override: false });
}

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8"),
);

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: packageJson.version,
  },
  reactStrictMode: true,
  // Transpile shared packages for proper bundling
  transpilePackages: ["@prostcounter/ui", "@hookform/resolvers", "zod"],
  // Exclude test-only packages from server bundles to prevent ESM/CommonJS issues
  serverExternalPackages: ["esbuild-wasm", "esbuild", "@esbuild/darwin-arm64"],
  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      // Prevent Turbopack from trying to bundle esbuild binaries
      esbuild: "esbuild-wasm",
      // Resolve zod v4 subpath exports for Turbopack compatibility
      // These map subpath imports to direct file imports within the zod package
      "zod/v4/core": "zod/v4/core/index.js",
      "zod/v4/mini": "zod/v4/mini/index.js",
      "zod/v4": "zod/v4/index.js",
    },
    resolveExtensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".mjs", ".cjs"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://www.gstatic.com https://fcm.googleapis.com https://www.googleapis.com https://www.googletagmanager.com",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    optimizePackageImports: ["zod", "@hookform/resolvers"],
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/image/**",
      },
      {
        pathname: "/**",
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

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js proxy, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Webpack configuration (Next.js 16+)
  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
      enabled: true,
    },
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  },
};

// Export the config with Sentry wrapper
// Serwist is now handled via @serwist/turbopack route handler (app/serwist/[path]/route.ts)
export default withSentryConfig(nextConfig, sentryConfig);
