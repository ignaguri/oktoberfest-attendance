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

**Always rename `apps/mobile/.env.local` before running `eas build --local` or `eas update`.** Metro loads `.env.local` during the bundle phase and it wins over EAS-injected env vars, silently baking local values (e.g. `EXPO_PUBLIC_API_URL=http://localhost:3001`) into production artifacts.

```bash
mv apps/mobile/.env.local apps/mobile/.env.local.bkp

# your build or update command

mv apps/mobile/.env.local.bkp apps/mobile/.env.local
```

This also affects prebuild plugins that write env into native files at build time (e.g. the watch app's `Info.plist` via `withWatchInfoPlistEnv.js`).

## OTA Updates (`eas update`)

For production OTAs, do **both**:

1. Rename `.env.local` aside (see above)
2. Run with both flags: `eas update --channel production --environment production --message "<msg>"`

`--environment production` alone is not enough — `.env.local` overrides it if present.

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

## iOS Local Build & App Store Submit

Use `eas build --local` to bypass EAS cloud build credits. See personal memory `eas-local-ios-build.md` for the full fastlane + Xcode submit flow.
