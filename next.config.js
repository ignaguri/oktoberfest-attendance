const { readFileSync } = require("fs");
const { join } = require("path");

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8"),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ["@sentry/node"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
