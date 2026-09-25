# Changelog

## [0.13.1] - 2026-09-25

### ✨ Features

- link the ProstCounter Instagram from web and mobile (#358)
- gallery viewer from feed photos, tab-bar padding (#356)
- personal festival progress on Home (solo mode) (#353)
- show friends' day plans and tent reservations (#351)
- tents and streak group criteria, real group rank in Wrapped (#349)
- rename Groups tab to Social, scope photo privacy by festival (#347)
- in-app feedback replaces Canny (#346)
- make friend requests visible outside the profile tab (#340)
- admin analytics dashboard (v0) (#339)

### 🐛 Bug Fixes

- Maß, not Mass, in the German record line
- progress card only on Home, stats in Attendance, clearer copy (#359)
- avatars, iOS badge, one Novu factory (#355)
- ask for a crowd report once per tent per day (#352)
- localize relative times on Hermes (#344)
- hide tent proximity banner once checked in today (#343)
- stop day-start pushes for next-morning backfills (#342)
- hide the Groups tab badge when no requests are pending (#341)
- keep sheet buttons clear of the Android nav bar (#338)
- keep the tent search list above the iOS keyboard (#337)
- stop notification taps from stacking duplicate screens (#336)
- give friend map pins a distinct blue (#335)
- show a stranger the real festival stats (#334)
- drop the stale achievements CHECK on pre-Drizzle databases (#333)

### 📚 Documentation

- add SOCIAL.md for the @prostcounter Instagram

### 🧪 Testing

- stop integration tests leaking users and festivals (#348)

### 🔧 Maintenance

- Play and Instagram renders for the store screenshots (#357)
- new iOS store screenshots and the pipeline that makes them (#354)
- code health pass (dead code, skipped tests, Wrapped cache on photos) (#350)
- use official prostcounter@gmail.com contact address (#345)

## [0.13.0] - 2026-09-23

### ✨ Features

- invite people to a group by name search (#329)
- marketing SEO pass, locale routing, and i18n completeness (#326)
- a real profile page for other users (#331)
- view a profile picture full size (#330)
- show tents in the feed, notify on day start (#328)
- edit attendances, names and groups from the mobile panel (#323)
- port the admin panel to the Expo app (#321)
- ask for notifications after friend, plan and group actions (#313)
- request to join a group (#312)
- say who you're going with on a day plan (#310)
- see which friends went on a past festival day (#308)
- plan festival days and see which friends are going (#307)
- Oktoberfest 2026 countdown, push reach and opening-day push (#304)
- offer the live festival and follow group festivals (#303)

### 🐛 Bug Fixes

- stop squashing portrait photos into squares on upload (#327)
- total spend from what people actually paid (#325)
- the server decides what a drink costs (#324)
- document the error body clients actually receive
- only stamp reservation rows whose notification sent (#322)
- stop soft-deleted days blocking drink logging (#314)
- notifications refresh flash, friends badge, disabled tabs (#309)
- security.txt contact and path, document email domains (#302)

### 📚 Documentation

- add Pomelli brand DNA reference
- how eas update picks env vars, and a safe OTA recipe (#306)

### 🔧 Maintenance

- publish OTA updates from a manual workflow (#315)
- 1.8.2 store release with notes and changelog (#311)
- 1.8.1 store release with notes and changelog (#305)
- merge graft context layer branch
- adopt Graft as a local context layer for Claude Code

## [0.12.0] - 2026-09-09

### ✨ Features

- cross-platform store update prompt via API (#298)
- new glyph art, and a detail sheet that explains itself (#297)
- send platform and version identification headers (#288)

### 🐛 Bug Fixes

- friend request states, map control, 2026 prices (#300)
- restore LogBox toast styling swallowed by NativeWind (#293)
- make the selector scroll and group past festivals (#291)
- surface the invite link right after group creation (#289)
- put default changelog inside each locale dir (#287)

### 📚 Documentation

- add the captcha rollout runbook (#299)

### ⚡ Performance Improvements

- paint the landing page before hydration, prerender it (#290)

### 🔧 Maintenance

- bump the small majors (@types/node, vitest) (#296)
- align Expo SDK 57 packages, RN 0.86.3 (#295)
- bump JS-only minor and patch versions (#294)
- replace the 7 OG images with the new set (#292)

## [0.11.0] - 2026-09-04

### ✨ Features

- carry a group over into a later festival (#284)

### 🐛 Bug Fixes

- move pnpm settings to pnpm-workspace.yaml, bump security pins (#283)
- unbreak App Links verification on the apex domain (#281)

### 🔧 Maintenance

- reconcile festival migrations with what prod actually ran (#285)
- add localized 36.txt release notes
- add the production hCaptcha sitekey to eas.json (#282)

## [0.10.2] - 2026-08-31

### ✨ Features

- lower rate limits, add dormant hCaptcha for web and mobile (#280)

## [0.10.1] - 2026-08-30

### ✨ Features

- add Dachauer Volksfest 2026 (active) and Rosenheimer Herbstfest 2026 (upcoming) (#278)

### 🐛 Bug Fixes

- drop useNavigation from map screen header
- make the map refresh button work, de-dupe locale keys
- tighten and clarify the official festival map link
- repair de unauthorized shape, fill 55 German gaps

### 🎨 Styling

- format the repo with oxfmt, ignore generated artifacts

## [0.10.0] - 2026-08-12

### ✨ Features

- drop achievements.rarity and the legacy achievement engine (#276)
- rebuild glyphs at 256px, track the asset pipeline
- unlock moment with toasts, confetti and glyphs (#274)
- same-day tent revisits, plus timezone and sync correctness fixes (#273)
- attendance festival strip + toggled day list (#272)
- scope tabs, close-to-unlocking rail, detail sheet (#269)
- series cards and category chips (#268)
- category-colored tier badges with glyph fallback icons (#267)
- achievements registry migration and backfill (Plan 2) (#264)
- achievements engine rebuild (Plan 1) (#263)
- Oktoberfest 2026 data, beer price post, bulletin campaign tracking (#260)

### 🐛 Bug Fixes

- prune local groups the server no longer returns
- stop the cold-start sync from racing the auth session
- hold the unlock toast and confetti longer
- show a single sync indicator, float it above tab bar (#271)
- stop reporting expected auth failures to Sentry (#270)
- add locale copy, fix category rendering bug (#266)
- drop the sharp tracing config, it broke deploys
- trace libvips through .pnpm, not the @img symlinks
- point outputFileTracingIncludes at the workspace root
- include sharp native binaries in output file tracing
- mark sharp as a server-external package
- pin sharp to one version, unblocking production sign-in (#265)
- revoke anon EXECUTE on 16 SECURITY DEFINER functions (#262)
- restore German umlauts, re-apply nearby-members festival scope (#261)

### ♻️ Code Refactoring

- derive rarity from tier, drop the dead route (#275)
- load sharp lazily so image failures stay contained

## [0.9.3] - 2026-07-27

### 🐛 Bug Fixes

- stop past-festival wrapped timing out on cache miss (#255)
- add NSMotionUsageDescription for CoreMotion (ITMS-90683) (#254)
- stop cold-start 401 storm (PROST-COUNTER-86) (#251)

### 🔧 Maintenance

- bump @types/node, fix missing expo-file-system dep (#258)
- bump mobile-only majors (firebase, gesture-handler, more) (#257)
- patch/minor bump + backbone tooling + web majors (#256)
- bump to 0.9.2 / mobile 1.5.2 + fix EAS android upload (#253)
- migrate to Expo SDK 57 (RN 0.86), unblock Xcode 26 (#252)
- pin transitive deps to patch security advisories (#250)
- patch security advisories via overrides (#249)
- resolve code/cloud workflow drift (#248)
- patch security advisories across web, mobile, api (#247)

## [0.9.2] - 2026-07-19

## [0.9.1] - 2026-05-05

### ✨ Features

- add daily push notification reminder for app engagement (#227)
- add Frühlingsfest 2026 festival, tents, and blog article (#226)
- add user-configurable tip calculation (#224)
- count radler as 0.5 beer in leaderboard (#215)
- add friendship system with request/accept flow (#207)
- iOS App Store promotion + Wrapped drink breakdown slide (#204)
- pre-release fixes for v0.8.0 release (#181)
- unified feed, groupless messages & social API tests (#179)
- Expo mobile app with full feature parity (#88)
- Hono backend migration with comprehensive API layer (#82)

### 🐛 Bug Fixes

- skip tutorial auto-start when festival is not active (#228)
- reduce Sentry noise from location errors and add FK validation (#225)
- iOS bug batch - leaderboard, groups, delete, offline (#211)
- location session duplicate + attendance delete 404 (#209)
- Sentry production bugs (error parsing, price mismatch, offline ID sync) (#205)
- avatar URL validation and Novu SDK upgrade (#140)
- handle server-side rendering in useMediaQuery hook
- `MIDDLEWARE_INVOCATION_FAILED` error (#81)

### 📚 Documentation

- slim CLAUDE.md and extract blog/builds runbooks
- improve CLAUDE.md — add blog section, trim duplication
- add branch workflow rule to CLAUDE.md

### ♻️ Code Refactoring

- use PROD_URL constant and deduplicate BlogLocale (#220)

### 🔧 Maintenance

- migrate ESLint+Prettier to oxlint + oxfmt (#242)
- remove Claude Code Review workflow (#238)
- merge feat/location-share-with-friends
- merge fix/upload-diagnostics
- merge fix/qr-code-join-deeplink
- merge fix/web-qr-share-deeplink
- merge fix/silent-delete-hazards
- merge fix/attendance-delete-silent-success
- track only Info.plist from generated ios/ directory
- gitignore build artifacts, videos, and local caches
- add root tsconfig and web app gitignore
- add production env vars to EAS and maven plugin
- bump version to 1.3.3
- upgrade dependencies (safe patches + lucide v1.0) (#213)
- bump mobile to v1.1.2 and configure Play Store submission
- bump web to v1.0.0 and mobile to v1.1.1
- upgrade dependencies across monorepo (#206)
- disable dependabot and upgrade dependencies (#202)
- ignore root-level ios/android directories
- ignore Tailwind v4 in Dependabot for mobile/root
- add Dependabot ignore rules for Expo SDK-locked deps
- add EAS build credentials to .gitignore
- optimize .easignore to reduce EAS build upload size
- update dependencies in package.json and pnpm-lock.yaml
- apply prettier formatting to all files (#87)
- remove generated SW files and update documentation (#83)
- enhance todo comment
- adjustments to server side of wrapped

## [0.8.0] - 2026-03-05

### ✨ Features

- 👥 View live crowd levels per tent directly on the home screen
- 📢 Report crowd levels and wait times for any tent
- 🎭 React to photos in your group gallery
- 💬 Comment on photos in your group gallery

## [0.7.0] - 2025-09-28

### 🐛 Bug Fixes

- copilot comments
- correct date assignment in addAttendance function

### 📚 Documentation

- update documentation and achievements actions

### ♻️ Code Refactoring

- remove console logs

### 🔧 Maintenance

- adjust pr comments
- update .gitignore to include cursor/mcp.json
- add security.txt endpoint for security policy

## [0.6.1] - 2025-09-05

## [0.6.0] - 2025-09-05

### 🐛 Bug Fixes

- reorder PNPM setup before Node.js setup and add proper pnpm caching

## [0.5.0] - 2025-09-05

### ✨ Features

- complete console logging migration to structured logging
- replace console calls in PWA and UI components
- implement centralized logging system

### 📚 Documentation

- add reservations & achievements implementation plan
- add comprehensive project overview Cursor rule

### 🎨 Styling

- proper redirect in logo click

### ♻️ Code Refactoring

- Improve date utils and component date handling

## [0.4.5] - 2025-08-31

### 🔧 Maintenance

- enhance logic to show current version only if changes exist
- remove version.ts and use package.json version

## [0.4.4] - 2025-08-31

### 🐛 Bug Fixes

- update GitHub Actions workflow pnpm version and lockfile handling

### 🔧 Chores

- convert version script to TypeScript with changelog preservation

## [0.4.3] - 2025-08-31

### 🐛 Bug Fixes

- update GitHub Actions workflow pnpm version and lockfile handling

## [0.4.0] - 2025-08-29

### 🔧 Infrastructure

- App update detection system
- Service worker improvements
- Version management automation
- Conventional commit enforcement
- Pre-commit hooks for code quality
- GitHub Actions release workflow

## [0.3.0] - 2025-08-20

### ✨ Features

- 🎪 Multi-festival support - Switch between 2024 and 2025 Oktoberfest!
- 👤 New user menu with profile and pages access
- 🏆 Completely new achievements system!

### 🔧 Infrastructure

- 📊 Festival-specific leaderboards and group competitions
- ⚡ Migrated all forms to React Hook Form + Zod for better performance
- 🔧 Admin panel for festival management

## [0.2.5] - 2024-12-19

### ✨ Features

- Added link to Oktoberfest map 🗺️
- Smoother page transitions 🚀

### 🔧 Infrastructure

- Initials for avatar
- Move "what can the app do" to the bottom

## [0.2.4] - 2024-12-19

### ✨ Features

- You can now delete an attendance in My attendance page 🗑️
- Added Share App button 📣

### 🔧 Infrastructure

- Added Invalidate cache tags

## [0.2.3] - 2024-12-19

### ✨ Features

- You can set a custom beer cost in your profile! 💶

## [0.2.2] - 2024-12-19

### ✨ Features

- New Global leaderboard! 🥇

### 🔧 Infrastructure

- Added Sentry

## [0.2.1] - 2024-12-19

### ✨ Features

- Implemented 'What's New' feature 🎉
- Now you can upload beer pictures! 📸
- Introduced group photo galleries 🖼️

### 🔧 Infrastructure

- Added app version checking
- Improved performance for image loading

## [0.2.0] - 2024-12-19

### ✨ Features

- Enhanced leaderboard with new sorting options

### 🐛 Bug Fixes

- Fixed various UI bugs
