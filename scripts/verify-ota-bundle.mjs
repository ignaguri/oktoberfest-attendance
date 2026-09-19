#!/usr/bin/env node
/**
 * Asserts that every EXPO_PUBLIC_* value the production build expects actually
 * made it into an exported bundle.
 *
 * This exists because it has already gone wrong once. An OTA carries only the
 * EAS server-side variables for its environment, and variables with *secret*
 * visibility are not among them - they can only be read on the EAS builder. A
 * production update once shipped with the Novu app id, Sentry DSN, Vexo key and
 * hCaptcha sitekey all empty, which took out the header bell on every launch.
 * The bundle looked fine at a glance, because the API and Supabase values were
 * public and the app still reached the right backend.
 *
 * `eas.json`'s build.production.env is the reference: the docs already require
 * keeping the EAS environment in sync with it, so anything listed there and
 * missing from the bundle means the EAS variable is absent or secret.
 *
 * Only key names are printed, never values, so this is safe to run in CI logs.
 *
 * Usage: node scripts/verify-ota-bundle.mjs <export-dir> [platform]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [, , exportDir, platform = "ios"] = process.argv;

if (!exportDir) {
  console.error("usage: node scripts/verify-ota-bundle.mjs <export-dir> [platform]");
  process.exit(2);
}

const easJsonPath = "apps/mobile/eas.json";
let productionEnv;
try {
  productionEnv = JSON.parse(readFileSync(easJsonPath, "utf8")).build?.production?.env ?? {};
} catch (error) {
  console.error(`Could not read ${easJsonPath}: ${error.message}`);
  process.exit(2);
}

const expected = Object.entries(productionEnv).filter(
  ([key, value]) => key.startsWith("EXPO_PUBLIC_") && typeof value === "string" && value.length > 0,
);

if (expected.length === 0) {
  console.error(`No EXPO_PUBLIC_* entries found in ${easJsonPath} build.production.env.`);
  process.exit(2);
}

const jsDir = join(exportDir, "_expo", "static", "js", platform);
let bundleFiles;
try {
  bundleFiles = readdirSync(jsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(jsDir, name));
} catch (error) {
  console.error(`Could not read bundle directory ${jsDir}: ${error.message}`);
  process.exit(2);
}

if (bundleFiles.length === 0) {
  console.error(`No .js bundles in ${jsDir}. Was the export run with --no-bytecode?`);
  process.exit(2);
}

// Concatenating is fine here: these are a handful of files and the check is a
// plain substring test, not a parse.
const haystack = bundleFiles.map((file) => readFileSync(file, "utf8")).join("\n");

const missing = expected.filter(([, value]) => !haystack.includes(value)).map(([key]) => key);

const totalBytes = bundleFiles.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `Checked ${expected.length} EXPO_PUBLIC_* values against ${bundleFiles.length} bundle file(s), ${totalBytes} bytes.`,
);

if (missing.length > 0) {
  console.error("\nMissing from the bundle:");
  for (const key of missing) console.error(`  - ${key}`);
  console.error(
    "\nEach of these is absent from the EAS environment, or set to secret visibility.\n" +
      "EXPO_PUBLIC_* values are compiled into the bundle anyway, so secret protects\n" +
      "nothing and silently empties them in an OTA. EAS cannot downgrade a secret\n" +
      "variable, so one created as secret has to be deleted and created again as\n" +
      "plaintext or sensitive. Publishing now would ship these empty.",
  );
  process.exit(1);
}

console.log("All expected EXPO_PUBLIC_* values are present.");
