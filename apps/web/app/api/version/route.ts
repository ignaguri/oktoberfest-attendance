import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { changelog } from "@/changelog";
import { APP_VERSION } from "@/lib/version";

const getVersionData = unstable_cache(
  async () => {
    const currentVersion = APP_VERSION;
    const currentChangelog = changelog[currentVersion] || [];

    const buildTime = process.env.BUILD_TIME || new Date().toISOString();

    return {
      version: currentVersion,
      buildTime,
      changelog: currentChangelog,
      requiresUpdate: false,
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
