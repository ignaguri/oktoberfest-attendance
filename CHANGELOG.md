# Changelog

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
