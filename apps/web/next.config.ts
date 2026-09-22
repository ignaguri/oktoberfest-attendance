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
const packageJson = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: packageJson.version,
  },
  reactStrictMode: true,
  // Transpile shared packages for proper bundling
  transpilePackages: ["@prostcounter/ui"],
  // Exclude test-only packages from server bundles to prevent ESM/CommonJS issues
  serverExternalPackages: ["esbuild-wasm", "esbuild", "@esbuild/darwin-arm64"],
  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      // Prevent Turbopack from trying to bundle esbuild binaries
      esbuild: "esbuild-wasm",
    },
    resolveExtensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".mjs", ".cjs"],
  },
  // The internal `[lang]` shapes are not public URLs, but they do resolve, so
  // send them to the canonical form rather than letting them fall through to
  // the auth redirect and look like a login wall. Redirects are matched on the
  // incoming request only, so these never see the rewrites' output and cannot
  // loop. /de and /es are left alone: there the prefix is the public URL.
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      { source: "/:lang(de|es)/blog", destination: "/blog/:lang", permanent: true },
      { source: "/:lang(de|es)/blog/:path*", destination: "/blog/:lang/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // hcaptcha.com covers js.hcaptcha.com (the API script) and
            // newassets.hcaptcha.com (the challenge frame). Without them the
            // widget is blocked before it can render, which reads as the
            // captcha simply not existing. Only script-src is set here, and
            // there is no default-src, so frames, XHR and styles are already
            // unrestricted and need no entry of their own.
            value:
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://www.gstatic.com https://fcm.googleapis.com https://www.googleapis.com https://www.googletagmanager.com https://hcaptcha.com https://*.hcaptcha.com",
          },
        ],
      },
      {
        source: "/.well-known/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
      {
        // Must come after the /.well-known rule above: the last matching
        // header wins, and security.txt is plain text, not JSON.
        source: "/.well-known/security.txt",
        headers: [
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Scanners only look at /.well-known/security.txt; the file itself is
          // served by app/api/security.txt/route.ts.
          source: "/.well-known/security.txt",
          destination: "/api/security.txt",
        },
      ],
      // Every page lives under app/[lang]/ so the root layout can put the right
      // language on <html>; nothing above a route param can read one. These map
      // the unchanged public URLs onto that segment, so no existing link or
      // indexed page moves. Rewrites run after middleware, so proxy.ts still
      // matches on the public path.
      //
      // afterFiles, not beforeFiles: these patterns are broad enough to swallow
      // robots.txt, sitemap.xml, the manifest and the icons, which are metadata
      // routes at the app root rather than pages. Running after the filesystem
      // lets those resolve first.
      afterFiles: [
        // Blog carries the locale one level in (/blog/de/slug), so it gets
        // pulled to the front and has to match before the generic case.
        {
          source: "/blog/:lang(de|es)",
          destination: "/:lang/blog",
        },
        {
          source: "/blog/:lang(de|es)/:path*",
          destination: "/:lang/blog/:path*",
        },
        // Already-prefixed marketing URLs (/de, /de/download) are their own
        // internal form, so they are left alone and everything else gets /en.
        {
          source: "/:path((?!de$|es$|de/|es/|api/|serwist/).*)",
          destination: "/en/:path",
        },
        {
          source: "/",
          destination: "/en",
        },
      ],
    };
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
