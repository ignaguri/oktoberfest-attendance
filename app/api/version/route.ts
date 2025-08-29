import { changelog } from "@/changelog";
import { APP_VERSION } from "@/version";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

// Cache the version data since it doesn't change frequently
const getVersionData = unstable_cache(
  async () => {
    const currentVersion = APP_VERSION;
    const currentChangelog = changelog[currentVersion] || [];

    // Get build time from environment or use current time
    const buildTime = process.env.BUILD_TIME || new Date().toISOString();

    return {
      version: currentVersion,
      buildTime,
      changelog: currentChangelog,
      requiresUpdate: false, // This will be determined by the service worker
      lastChecked: new Date().toISOString(),
    };
  },
  ["app-version-data"],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ["version", "app-data"],
  },
);

export async function GET() {
  const versionData = await getVersionData();
  return NextResponse.json(versionData);
}
