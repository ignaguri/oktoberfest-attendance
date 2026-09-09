import { describe, expect, it } from "vitest";

import { APP_VERSIONS, getAppVersions } from "../app-version";

describe("getAppVersions", () => {
  it("returns a latest and minSupported for both platforms", () => {
    const versions = getAppVersions();

    for (const platform of ["ios", "android"] as const) {
      expect(versions[platform].latest).toMatch(/^\d+\.\d+\.\d+$/);
      expect(versions[platform].minSupported).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  // Captured before mutating: comparing two post-mutation reads can't fail,
  // since without the copy both sides would agree on the mutated value.
  it("returns a copy, so a caller cannot mutate the shared constant", () => {
    const originalLatest = APP_VERSIONS.ios.latest;

    const versions = getAppVersions();
    versions.ios.latest = "99.0.0";

    expect(getAppVersions().ios.latest).toBe(originalLatest);
    expect(APP_VERSIONS.ios.latest).toBe(originalLatest);
  });

  // The floor exists because builds below it ship no hCaptcha sitekey and are
  // rejected by GoTrue once captcha is on. A floor above what the store serves
  // would strand users on a version they cannot reach.
  it("never sets a floor newer than the latest published build", () => {
    const versions = getAppVersions();

    // Compared segment by segment on purpose: "1.10.0" sorts before "1.9.0"
    // as a string, which would make this assertion pass on a broken floor.
    const isAtMost = (a: string, b: string) => {
      const left = a.split(".").map(Number);
      const right = b.split(".").map(Number);

      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const l = left[index] ?? 0;
        const r = right[index] ?? 0;
        if (l !== r) {
          return l < r;
        }
      }
      return true;
    };

    for (const platform of ["ios", "android"] as const) {
      const { latest, minSupported } = versions[platform];
      expect(isAtMost(minSupported, latest)).toBe(true);
    }
  });
});
