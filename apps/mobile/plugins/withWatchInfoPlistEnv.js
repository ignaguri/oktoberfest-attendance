const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin that injects runtime config into the watch target's Info.plist
 * at prebuild time, reading from Expo env vars so the keys stay OUT of the
 * expoConfig (which is fingerprinted).
 *
 * Keys injected (opt-in — only written if the env var is set):
 *   - WATCH_API_BASE_URL       from EXPO_PUBLIC_WATCH_API_BASE_URL
 *   - WATCH_SUPABASE_URL       from EXPO_PUBLIC_SUPABASE_URL
 *   - WATCH_SUPABASE_ANON_KEY  from EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Why a plugin rather than a hardcoded Info.plist entry:
 *   The watch has no access to Expo env at runtime (no React Native,
 *   no process.env). Injecting into the target's Info.plist is the only
 *   per-build surface Swift can read via Bundle.main.
 *
 * The plugin edits `apps/mobile/targets/watch/Info.plist` directly. That
 * file is referenced from the Xcode project at `../targets/watch/Info.plist`
 * (see INFOPLIST_FILE in project.pbxproj), so no build-output rewriting needed.
 */

const WATCH_INFO_PLIST_PATH = path.join("targets", "watch", "Info.plist");

/** @type {Array<{ key: string, envVar: string }>} */
const INJECTIONS = [
  { key: "WATCH_API_BASE_URL", envVar: "EXPO_PUBLIC_WATCH_API_BASE_URL" },
  { key: "WATCH_SUPABASE_URL", envVar: "EXPO_PUBLIC_SUPABASE_URL" },
  { key: "WATCH_SUPABASE_ANON_KEY", envVar: "EXPO_PUBLIC_SUPABASE_ANON_KEY" },
];

function writePlistKey(src, key, value) {
  // Replace the existing pair if present — tolerate any whitespace between
  // the two elements so we stay robust across formatter output.
  const existingRe = new RegExp(`([ \\t]*)<key>${key}</key>\\s*<string>[^<]*</string>`);
  if (existingRe.test(src)) {
    return src.replace(existingRe, `$1<key>${key}</key>\n$1<string>${value}</string>`);
  }
  // Otherwise insert right before the closing '  </dict>\n</plist>' (the two
  // leading spaces are the root <dict>'s indent). Match the full sequence so
  // indentation is preserved after the injection.
  const closingAnchor = "  </dict>\n</plist>";
  if (!src.includes(closingAnchor)) {
    throw new Error(
      `withWatchInfoPlistEnv: could not find '  </dict>\\n</plist>' anchor in ${WATCH_INFO_PLIST_PATH}`,
    );
  }
  // Match the 4-space indent used by the existing keys inside the root <dict>.
  const block = `    <key>${key}</key>\n    <string>${value}</string>\n`;
  return src.replace(closingAnchor, `${block}${closingAnchor}`);
}

module.exports = function withWatchInfoPlistEnv(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const plistPath = path.join(cfg.modRequest.projectRoot, WATCH_INFO_PLIST_PATH);

      if (!fs.existsSync(plistPath)) {
        console.warn(`withWatchInfoPlistEnv: ${plistPath} not found — skipping.`);
        return cfg;
      }

      let src = fs.readFileSync(plistPath, "utf-8");
      let changed = false;

      for (const { key, envVar } of INJECTIONS) {
        const value = process.env[envVar];
        if (!value) {
          console.log(`withWatchInfoPlistEnv: ${envVar} not set — skipping ${key}.`);
          continue;
        }
        const updated = writePlistKey(src, key, value);
        if (updated !== src) {
          src = updated;
          changed = true;
          console.log(`withWatchInfoPlistEnv: injected ${key} into ${WATCH_INFO_PLIST_PATH}`);
        }
      }

      if (changed) {
        fs.writeFileSync(plistPath, src, "utf-8");
      }

      return cfg;
    },
  ]);
};
