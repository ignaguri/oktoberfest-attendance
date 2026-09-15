# Mobile Builds & Deployment

## EAS Build Profiles

```bash
eas build --profile development --platform android   # Development build
eas build --profile preview --platform android       # Preview APK for internal testing
eas build --profile production-apk --platform android # Production-env APK for pre-release testing
eas build --profile production --platform android    # Production AAB for Play Store
```

The `production-apk` profile produces an APK (not AAB) using production env values — share directly with testers before Play Store release. It uses the `production-apk` OTA update channel to avoid conflicts with Play Store builds.

## Critical: Rename `.env.local` Before Any EAS Artifact

**Always rename `apps/mobile/.env.local` (and `.env`, which also points at localhost) before running `eas build --local` or a local `expo export`.** Metro loads them during the bundle phase and they win over EAS-injected env vars, silently baking local values (e.g. `EXPO_PUBLIC_API_URL=http://localhost:3001`) into production artifacts. `eas update --environment` does not load them, but it has its own env trap: see [OTA Updates](#ota-updates-eas-update).

```bash
mv apps/mobile/.env.local apps/mobile/.env.local.bkp

# your build or update command

mv apps/mobile/.env.local.bkp apps/mobile/.env.local
```

This also affects prebuild plugins that write env into native files at build time (e.g. the watch app's `Info.plist` via `withWatchInfoPlistEnv.js`).

### `expo prebuild` dirties tracked native files

`apps/mobile/targets/watch/Info.plist` is committed, and `withWatchInfoPlistEnv.js` writes `WATCH_SUPABASE_URL` / `WATCH_SUPABASE_ANON_KEY` into it from whatever env is loaded. So any local `expo prebuild`, `pnpm ios` or `pnpm ios:clean` leaves those keys in your working tree (`targets/watch/Assets.xcassets/AppIcon.appiconset/Contents.json` picks up a change too).

Check `git status` after a prebuild and revert them unless you actually mean to change them:

```bash
git checkout -- apps/mobile/targets/watch/Info.plist \
  apps/mobile/targets/watch/Assets.xcassets/AppIcon.appiconset/Contents.json
```

Committing them by accident pins someone else's build to your local Supabase, and doing it after a prebuild with production env in place would put the production key in the repo.

## Native devDependencies

`apps/mobile` carries two devDependencies that build native code: `drizzle-kit`
and `better-sqlite3`. `better-sqlite3` backs the SQLite integration tests under
`lib/database/__tests__` — it is never imported by app code and never bundled.

EAS installs devDependencies, so both have to resolve on the build machine.
`better-sqlite3` ships prebuilds for current Node LTS and falls back to node-gyp
if none matches, which is the failure mode to watch: it surfaces as a failed
install rather than as a failed build step. If an EAS build ever breaks on it,
move it to the workspace root rather than dropping the tests, since the mobile
vitest run is the only thing that needs it.

## OTA Updates (`eas update`)

An OTA bundle only gets the env values `eas update` can see, and that is a different set from what a store build gets:

- **Store builds** (`eas build`) use the `env` block of the profile in `eas.json`, plus EAS server-side variables.
- **`eas update --environment <env>`** ignores `eas.json` entirely. It sets `EXPO_NO_DOTENV=1`, so no `.env*` file is loaded either, and bundles with the EAS server-side variables for that environment only. Variables with **secret** visibility are not included: secret values can only be read on the EAS builder.

So every `EXPO_PUBLIC_*` the JS reads must exist on EAS for the environment, with **plaintext** or **sensitive** visibility. `EXPO_PUBLIC_*` values are compiled into the bundle anyway, so secret visibility protects nothing and silently empties them in OTAs. Keep those values in sync with `build.production.env` in `eas.json`. EAS refuses to change a secret variable to plaintext or sensitive, so a variable created as secret has to be created again.

This broke production once: the Novu app id, Sentry DSN and Vexo key were secret and the hCaptcha sitekey wasn't on EAS at all, so the OTA shipped with all four empty, `NovuProviderWrapper` rendered no provider, and the header bell threw `useNovu must be used within a <NovuProvider />` on every launch. The API and Supabase values were public, so the app still reached the right backend and the bundle looked fine at a glance.

### Publishing a production OTA

1. Work from an up-to-date `main`, and move `.env.local` and `.env` aside (see above). They are not loaded by `eas update`, but `expo export` in step 2 does load them.
2. Verify the bundle before publishing. `--clear` matters: Metro's transform cache keeps env values inlined by earlier runs, which can hide a missing variable.

   ```bash
   cd apps/mobile
   npx eas-cli env:exec production 'EXPO_NO_DOTENV=1 npx expo export --clear --platform ios --no-bytecode --output-dir /tmp/ota-check'
   grep -c '<a value you expect, e.g. the Novu app id>' /tmp/ota-check/_expo/static/js/ios/*.js
   ```

   Check the Novu app id, hCaptcha sitekey, Sentry DSN, Vexo key, API URL and Supabase URL. Grep the `--no-bytecode` export: short strings don't reliably show up when grepping a Hermes `.hbc` file.

3. Publish with the cache cleared:

   ```bash
   eas update --channel production --environment production --clear-cache --message "<msg>"
   ```

4. Restart the app twice on a real device (the first launch downloads the update, the second runs it) before walking away.

If an OTA breaks launch, roll phones back to the bundle embedded in their binary:

```bash
eas update:roll-back-to-embedded --branch production --runtime-version <runtimeVersion> --platform all --message "<why>"
```

An error caught by the root `ErrorBoundary` shows only "An unexpected error occurred" in release builds, and Sentry is empty too if the DSN is what went missing. To read the real error from a connected iPhone, stream its log with `idevicesyslog -n -u <udid>` (from `libimobiledevice`; find the udid with `idevice_id -n`), tap "Try Again" on the error screen, and grep for `ProstCounter(React)`.

### Native dependencies can't ship as an OTA

Adding a dependency that bundles native code turns the next mobile release into a full store build — it can never go out via `eas update`, no matter how small the JS change around it looks.

Case in point: the captcha work pulled in `@hcaptcha/react-native-hcaptcha`, which depends on `react-native-webview`. That package was never part of this project before — at the point captcha landed it only existed as an unresolved `optional: true` peer of `expo` — so it isn't autolinked into any binary already in users' hands.

Feature flags and disabled config don't protect against this, because the crash isn't a render-time concern. `react-native-webview` resolves its native module with `TurboModuleRegistry.getEnforcing(...)` at module-evaluation time, so the moment something `import`s it (even transitively, even if the component that uses it is never mounted), it throws if the native module isn't linked. Shipping an OTA with that import reachable from a screen users hit unconditionally (e.g. sign-in) would crash that screen on every phone still running an older binary.

The safeguard: whenever a change like this lands, bump `runtimeVersion` in the same commit. A new runtime fingerprint means EAS Update can't offer that JS bundle to a binary that doesn't already match it, so the incompatible code only ever reaches builds that were compiled with it in place.

To catch this in review: check whether a change adds or updates anything under a package that ships an `ios/` or `android/` directory, or anything else Expo would autolink. If it does, treat the release as a required store build and bump `runtimeVersion`, not as something that can ride an OTA.

## Version Management

### App Version

When bumping the app version, update it in **both** places:

- `apps/mobile/app.config.ts` → `version` field
- `apps/mobile/ios/ProstCounter/Info.plist` → `CFBundleShortVersionString`

The `Info.plist` value takes precedence in bare workflow iOS builds — a mismatch causes App Store submission to use the wrong version.

### Runtime Version (`runtimeVersion`)

Update in `apps/mobile/app.config.ts` before each release to generate a new EAS fingerprint:

- **Fixes/adjustments within same version**: increment letter suffix (`1.0.1-c` → `1.0.1-d`)
- **New feature releases**: bump version number (`1.0.1-d` → `1.0.2-a`)

### npm Version Script

See **[VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md)** for the automated version bump / changelog / release tag workflow (`pnpm run version:patch`, etc.).

## Play Store Submission

**`eas submit` cannot deliver release notes.** It uploads the AAB and nothing else — there is no release-notes option on the Android submitter — so the `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt` files never reach Google through it. Use `fastlane supply`, which ships both in one edit. There is no Fastfile, so invoke it directly:

```bash
# The AAB is not local after a cloud build. Grab artifacts.applicationArchiveUrl:
eas build:list --platform android --limit 1 --json --non-interactive
curl -sL -o app.aab "<applicationArchiveUrl>"

fastlane supply \
  --package_name com.prostcounter.app \
  --aab app.aab \
  --track production \
  --release_status completed \
  --json_key apps/mobile/keys/play-store-service-account.json \
  --metadata_path fastlane/metadata/android \
  --skip_upload_metadata true --skip_upload_images true --skip_upload_screenshots true
```

Add `--validate_only true` first. It builds and validates the whole edit without committing, and it doubles as a check on whether the versionCode was already consumed by an earlier half-failed run.

### Why the skip flags

`fastlane/metadata/android/<locale>/` also holds `title.txt`, `short_description.txt` and `full_description.txt`. Without `--skip_upload_metadata`, supply pushes those too and **overwrites the live Play listing** with whatever the repo happens to contain.

That flag does not skip changelogs — its own help text reads "changelogs not included". `--skip_upload_changelogs` is a separate flag; leave it off or the release notes are exactly what you lose.

### Everything under `metadata/android/` must be a locale code

A directory there that isn't a locale gets read as one, and Google rejects the **entire edit**:

```
Preparing uploads for language 'changelogs'...
[!] changelogs - Invalid request
```

The fallback changelog belongs at `<locale>/changelogs/default.txt`, not in a shared top-level `changelogs/`. This blocked the 1.7.0 release until it was fixed.

Note that supply commits its edit at the very end, so a failure like that publishes nothing at all, binary included. A failed run is safe to retry once the cause is fixed.

### Rollout

`--track production` with `--release_status completed` goes to 100% of users once Google approves. Use `--rollout 0.2` for a staged release you can halt if crash rates spike.

## iOS Local Build & App Store Submit

Use `eas build --local` to bypass EAS cloud build credits. See personal memory `eas-local-ios-build.md` for the full fastlane + Xcode submit flow.

`eas submit --platform ios` uploads to App Store Connect and the build lands in TestFlight. It does **not** release to the App Store: that still needs the version created in ASC and submitted for review by hand.
