# Play Store listing

Source-of-truth for the ProstCounter Play Store listing copy and screenshots lives at [`fastlane/metadata/android/`](../fastlane/metadata/android/). The structure follows the [fastlane/supply](https://docs.fastlane.tools/actions/supply/) convention.

We don't currently run fastlane — submission is handled by EAS (`apps/mobile/eas.json`, `submit.production.android`). Listing copy is updated by **manually pasting from these files into Play Console**. Wiring fastlane to push directly is a future option; the directory layout is already compatible.

## What lives where

```
fastlane/metadata/android/
  en-US/                            # English — canonical source
    title.txt                       # ≤ 30 characters
    short_description.txt           # ≤ 80 characters
    full_description.txt            # ≤ 4000 characters
    video.txt                       # optional YouTube URL, blank by default
    images/
      icon/                         # 512×512 PNG, optional override
      featureGraphic/               # 1024×500 PNG (header image in listing)
      phoneScreenshots/             # 2-8 PNGs, see README in that folder
  de-DE/                            # same structure
  es-ES/                            # same structure
  changelogs/
    default.txt                     # fallback "what's new" text
    <versionCode>.txt               # optional, version-specific notes
```

## Updating for a release

1. **Copy edit**: open the relevant `*_description.txt` files; verify character limits with `wc -m` (macOS) — Play Console counts characters, not bytes. The `wc -c` byte count overcounts for German umlauts and Spanish accents, so prefer `-m` or this snippet:

   ```bash
   awk 'BEGIN{n=0} {n+=length($0)+1} END{print n-1}' fastlane/metadata/android/de-DE/short_description.txt
   ```

2. **Screenshots**: re-export images per the spec in each locale's `images/phoneScreenshots/README.md`. Capture from a `production-apk` build (`eas build --profile production-apk --platform android`), not a dev build.

3. **Changelog**: either update `changelogs/default.txt` for a generic message, or drop a per-version file like `changelogs/120.txt` (matches the Android `versionCode`). See [`docs/VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) for how versions are bumped.

4. **Sync to Play Console** (manual until fastlane is wired):
   - Play Console → ProstCounter → **Main store listing** → switch language tab → paste `title.txt`, `short_description.txt`, `full_description.txt`.
   - Upload screenshots from `images/phoneScreenshots/` per locale.
   - Upload feature graphic from `images/featureGraphic/` (English only is fine — Play Console falls back to en-US for missing locales).
   - **What's new** field on the release: paste from `changelogs/<versionCode>.txt` or `changelogs/default.txt`.

5. **Verify**: open the listing on a device in each locale (Play Store app → search "ProstCounter") to confirm the rendering.

## Field limits (Play Console)

| Field | Limit |
|---|---|
| Title | 30 characters |
| Short description | 80 characters |
| Full description | 4000 characters |

## Screenshot specs

See [`fastlane/metadata/android/en-US/images/phoneScreenshots/README.md`](../fastlane/metadata/android/en-US/images/phoneScreenshots/README.md) for sizes, suggested shot list, and capture workflow. The DE and ES READMEs reference the same workflow with locale-specific notes.

## Wiring fastlane later (optional)

If we want push-from-CI instead of copy-paste:

1. `bundle add fastlane --group=:development` at the repo root (or use `gem install fastlane` standalone).
2. Add `fastlane/Fastfile` with a `lane :metadata do supply(skip_upload_apk: true, skip_upload_aab: true) end`.
3. Reuse the existing `apps/mobile/keys/play-store-service-account.json` referenced in `eas.json`.
4. Run `bundle exec fastlane metadata`.

The directory layout in this repo is ready as-is — no migration required.
