#!/usr/bin/env tsx
/* eslint-disable no-console */
import { writeFileSync } from "fs";
import { resolve } from "path";

import { app } from "../index";

/**
 * Generate OpenAPI specification JSON file
 * Usage: pnpm generate-spec
 */
async function generateOpenAPISpec() {
  try {
    console.log("🔧 Generating OpenAPI specification...");

    // Create a mock request to trigger OpenAPI doc generation
    const req = new Request("http://localhost/openapi.json") as Request;
    const res = await app.fetch(req);

    if (!res.ok) {
      throw new Error(`Failed to generate spec: ${res.statusText}`);
    }

    const spec = (await res.json()) as Record<string, any>;

    // Write to file
    const outputPath = resolve(__dirname, "../../openapi.json");
    writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");

    console.log("✅ OpenAPI spec generated at:", outputPath);
    console.log(`📊 Found ${Object.keys(spec.paths || {}).length} endpoints`);
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }
}

generateOpenAPISpec();
