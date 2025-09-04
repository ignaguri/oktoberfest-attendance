#!/usr/bin/env tsx
import { execSync } from "child_process";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function main() {
  const apiKey = process.env.NOVU_API_KEY;
  if (!apiKey) {
    throw new Error("NOVU_API_KEY is required in .env.local");
  }

  // For production deployment, use the production URL
  const bridgeUrl =
    process.env.NOVU_BRIDGE_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3008"}/api/novu`;

  console.log("🔄 Syncing Novu workflows...");
  console.log(`📍 Bridge URL: ${bridgeUrl}`);

  try {
    // Use the Novu CLI to sync workflows
    const command = `npx novu@latest sync --bridge-url ${bridgeUrl} --secret-key ${apiKey}`;

    console.log("🚀 Running sync command...");
    execSync(command, { stdio: "inherit" });

    console.log("✅ Workflows synced successfully!");
  } catch (error: any) {
    console.error("❌ Failed to sync workflows:", error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`💥 Script failed:`, err.message);
  process.exit(1);
});
