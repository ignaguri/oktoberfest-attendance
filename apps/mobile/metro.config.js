const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const { resolve } = require("metro-resolver");
const path = require("path");

// Find the project and workspace directories
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Force Metro to resolve (sub)dependencies only from the project's node_modules
config.resolver.disableHierarchicalLookup = true;

// Tailwind v4 doesn't export `tailwindcss/resolveConfig`, but some Gluestack utils still import it.
// We alias it to a local shim to unblock native bundling.
const tailwindResolveConfigShim = path.join(
  projectRoot,
  "shims",
  "tailwindcss",
  "resolveConfig.js",
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "tailwindcss/resolveConfig") {
    return resolve(context, tailwindResolveConfigShim, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = withNativewind(config, { input: "./global.css" });
