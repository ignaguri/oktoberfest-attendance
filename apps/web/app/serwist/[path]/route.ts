import { spawnSync } from "node:child_process";

import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { url: "/offline", revision },
      { url: "/", revision: revision + "-home" },
      { url: "/home", revision: revision + "-home-page" },
    ],
    swSrc: "app/sw.ts",
    nextConfig: {},
  });
