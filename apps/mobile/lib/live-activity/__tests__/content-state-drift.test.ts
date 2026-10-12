import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LiveActivityAttributesSchema,
  LiveActivityStateSchema,
} from "@prostcounter/shared/schemas";
import { describe, expect, it } from "vitest";

// Vitest runs from apps/mobile (pnpm --filter).
const mobileRoot = process.cwd();
const swiftCopies = [
  "targets/live-activity/_shared/ProstActivityAttributes.swift",
  "modules/live-activity/ios/ProstActivityAttributes.swift",
];

describe("Swift ProstActivityAttributes mirrors the shared schema", () => {
  for (const relativePath of swiftCopies) {
    it(`${relativePath} declares every key`, () => {
      const source = readFileSync(resolve(mobileRoot, relativePath), "utf8");
      const keys = [
        ...Object.keys(LiveActivityStateSchema.shape),
        ...Object.keys(LiveActivityAttributesSchema.shape),
      ];
      for (const key of keys) {
        expect(source).toMatch(new RegExp(`var ${key}:`));
      }
    });
  }
});

describe("getRunningState encodes the shared state keys", () => {
  it("LiveActivityModule.swift writes every key", () => {
    const source = readFileSync(
      resolve(mobileRoot, "modules/live-activity/ios/LiveActivityModule.swift"),
      "utf8",
    );
    for (const key of Object.keys(LiveActivityStateSchema.shape)) {
      expect(source).toMatch(new RegExp(`"${key}": state\\.${key}`));
    }
  });
});
