# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProstCounter is a cross-platform app (Next.js PWA + Expo mobile) for tracking Oktoberfest and other beer festivals attendance. Users log daily beer consumption, participate in group competitions, view leaderboards, and earn achievements.

**Important**: Server actions were migrated to Hono API (commit #86) for Expo compatibility. Both web and mobile now use the same REST API via the type-safe API client.

## Development Commands

### Core Development

- `pnpm dev:web` - Start web development server at localhost:3008
- `pnpm dev:mobile` - Start Expo mobile development
- `pnpm build` - Production build
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix ESLint errors

### Testing Commands

- `pnpm test` - Run all tests (unit + integration)
- `pnpm test --filter=@prostcounter/api` - Run tests for specific package
- `pnpm test:watch` - Run tests in watch mode

### Supabase Database Commands

- `pnpm sup:start` - Start local Supabase (requires Docker)
- `pnpm sup:stop` - Stop local Supabase
- `pnpm sup:db:reset` - Reset DB and run migrations (full reset, useful for final validation)
- `pnpm sup:db:pull` - Pull remote DB changes
- **Note**: We don't push DB changes; we reset the local DB to verify the full migration chain works properly
- `pnpm sup:db:types` - Generate TypeScript types from DB schema
- `pnpm sup:mig:new` - Create new migration file
- **During development**: There's no need to reset the database every time you create or modify a migration. Instead, apply your migration SQL directly using the Supabase MCP `execute_sql` tool or by running the SQL file as a script against the local database. Only use `pnpm sup:db:reset` when you need to verify the full migration chain from scratch. This is especially important when multiple agents work in parallel, since they share the same local Supabase instance and a reset would wipe other agents' applied migrations.

### Mobile Build Commands

- `eas build --profile development --platform android` - Development build with local backend
- `eas build --profile preview --platform android` - Preview build (APK) for internal testing
- `eas build --profile production-apk --platform android` - Production environment APK for pre-release testing
- `eas build --profile production --platform android` - Production AAB for Play Store submission

**Note**: The `production-apk` profile builds an APK (not AAB) with production environment values, suitable for sharing with testers before Play Store release. It uses the "production-apk" OTA update channel to avoid conflicts with Play Store builds.

**Important - Runtime Version**: Before building a new release, update the `runtimeVersion` in `apps/mobile/app.config.ts` to generate a new fingerprint:
- For fixes/adjustments within the same version: increment the letter suffix (e.g., `1.0.1-c` → `1.0.1-d`)
- For new feature releases: update to a new version number (e.g., `1.0.1-d` → `1.0.2-a`)

**Important - Version Sync**: When bumping the app version, update it in **both** `apps/mobile/app.config.ts` (`version` field) **and** `apps/mobile/ios/ProstCounter/Info.plist` (`CFBundleShortVersionString`). The Info.plist value takes precedence in bare workflow iOS builds, so a mismatch will cause App Store submission to use the wrong version.

### Test Users (Local Development)

Seed data creates users `user1@example.com` through `user10@example.com` with password `password`.

## Architecture

For the full system architecture, monorepo structure, API routes, testing infrastructure, and database schema, see **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

### Tech Stack

- **Web**: Next.js 15, React 19, TypeScript
- **Mobile**: Expo/React Native with Gluestack UI + NativeWind
- **Backend**: Supabase (auth, database, storage)
- **API**: Hono + OpenAPI (type-safe REST API in `packages/api/`)
- **State Management**: TanStack React Query v5
- **i18n**: i18next + react-i18next (shared across web and mobile)
- **Testing**: Vitest (unit & integration tests)
- **Build System**: Turborepo with pnpm workspaces

### Key Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@prostcounter/api` | `packages/api/` | Hono API routes & business logic |
| `@prostcounter/api-client` | `packages/api-client/` | Auto-generated type-safe API client |
| `@prostcounter/shared` | `packages/shared/` | Shared utilities, types, schemas, i18n, hooks |
| `@prostcounter/db` | `packages/db/` | Database types (generated from Supabase) |
| `@prostcounter/ui` | `packages/ui/` | Shared UI utilities (`cn()`, etc.) |

### Regenerating the API Client

After changing Hono API routes:
1. `pnpm --filter=@prostcounter/api generate-spec` - Generate OpenAPI spec
2. `pnpm --filter=@prostcounter/api-client generate` - Generate TypeScript client

## Web App

### Route Groups

The web app (`apps/web/`) uses Next.js App Router with three route groups:

- **`(private)/`** - Auth-protected routes (home, attendance, groups, leaderboard, profile, admin)
- **`(public)/`** - Auth pages (sign-in, sign-up, forgot-password)
- **`(marketing)/`** - Public marketing pages and blog (no auth required)

### Styling

- **shadcn/ui + Tailwind CSS** for all web components
- Primary: `yellow-500` (#F59E0B), `yellow-600` (#D97706)

## Blog / Marketing Content

The web app has a file-based blog at `apps/web/content/blog/` using **MDX** (Markdown + JSX).

### Content Structure

```
apps/web/content/blog/
├── en/                    # English articles
├── de/                    # German translations
└── es/                    # Spanish translations
```

Each article is an `.mdx` file with YAML frontmatter. **All articles must exist in all 3 locales.**

### Writing a Blog Article

Frontmatter format:
```yaml
---
title: "Article Title"
description: "Short description for previews and SEO"
date: "2026-04-09"
lastModified: "2026-04-09"
author: "ProstCounter Team"
category: "festivals"           # festivals | tips | culture | news
tags: ["oktoberfest", "2026", "guide"]
featuredImage: "/images/prost-counter-og-1.jpg"
locale: "en"                    # en | de | es
---
```

### Available MDX Components

These custom components can be used inside blog articles:

- **`<CTA />`** - Call-to-action box for the ProstCounter app (app store links + sign-up button). Include at the end of every article.
- **`<DownloadButtons />`** - Download button group for app distribution
- **`<AppScreenshot src="" alt="" caption="" />`** - Responsive image with caption
- **`<FestivalInfo name="" dates="" location="" description="" />`** - Festival info card with icons

### Blog Utilities

- `apps/web/lib/blog.ts` - `getAllPosts()`, `getPostBySlug()`, `getPostsByCategory()`, etc.
- `apps/web/components/blog/` - `ArticleLayout`, `BlogIndexView`, `ArticleCard`, `CategoryView`, `MDXComponents`

### Blog Routes

- `/blog` - English index
- `/blog/[slug]` - English article
- `/blog/de/[slug]` - German article
- `/blog/es/[slug]` - Spanish article
- `/blog/category/[category]` - Category page (supports locale prefixes too)

## Important Patterns

### Authentication Flow

- Supabase Auth with Row Level Security (RLS)
- **Web**: Private layout redirects unauthenticated users to `/sign-in`
- **Mobile**: NavigationGuard component handles route protection in `_layout.tsx`

### Provider Architecture (Mobile)

The mobile app uses a nested provider structure in `apps/mobile/app/_layout.tsx`:

```
GestureHandlerRootView → SafeAreaProvider → I18nextProvider → ErrorBoundary
  → DataProvider → ApiClientProvider → GluestackUIProvider → AuthProvider
    → FestivalProvider → NavigationGuard → Stack
```

**Important**: GluestackUIProvider must be inside ApiClientProvider because OverlayProvider renders modals/sheets via portal.

### Form Validation

- **React Hook Form + Zod** for all forms
- Schemas in `packages/shared/src/schemas/`

### Internationalization (i18n)

- i18next shared between web and mobile in `packages/shared/src/i18n/`
- Use `useTranslation()` hook from `@prostcounter/shared/i18n`

## Styling (Mobile)

- **Gluestack UI + NativeWind** (Tailwind classes via `className`)
- **IMPORTANT**: Do NOT use React Native `StyleSheet` or inline style objects
- Use `Colors` and `IconColors` from `@/lib/constants/colors` for icon props
- Use `lucide-react-native` for icons

## Mobile Development Patterns

**Reference implementation**: `apps/mobile/app/(tabs)/profile.tsx`

### Key Patterns

1. **Componentization**: Extract reusable sections to `components/[feature]/`
2. **Translations**: Never use `defaultValue` in `t()` calls. Always add keys to **all 3 locale files** (`en.json`, `de.json`, `es.json`) with proper translations (correct umlauts for German, accents/punctuation for Spanish)
3. **Layout**: Use `VStack`/`HStack` with `space` prop instead of margin
4. **Forms**: Use `useForm` with `values` option (not `defaultValues` + useEffect)
5. **Dialogs**: Use `useAlertDialog` hook from alert-dialog component
6. **Accessibility**: Add `accessibilityLabel` and `accessibilityHint` to interactive elements

## Important Development Notes

- **Database Testing**: Always reset local DB (`pnpm sup:db:reset`) to test migrations
- **RLS Policies**: All tables have Row Level Security - test with real Supabase
- **Before Committing**: Always run `pnpm lint` and `pnpm type-check` on the whole project and ensure there are no errors
- **Commit Message Title**: Max 72 characters. The pre-commit hook enforces this limit
- **Work on Branches**: Never commit directly to main. Always create a feature branch for changes and submit via pull request
- **Do NOT Push**: Do not push commits to the remote repository unless explicitly asked
- **Production APK Testing**: Use `eas build --profile production-apk --platform android` to create a production-environment APK for testing before Play Store release. Download the APK from the EAS dashboard and share directly with testers
- **No `defaultValue` in translations**: Never use `defaultValue` fallbacks in `t()` calls. Always add translation keys to all 3 locale files (`en.json`, `de.json`, `es.json`). Use proper characters: umlauts (ä, ö, ü, ß) for German, accents and inverted punctuation (á, é, í, ó, ú, ñ, ¿, ¡) for Spanish
- **No className string interpolation**: Never use template literals or string concatenation for dynamic `className` values. Use the `cn()` utility from `@prostcounter/ui` (`packages/ui/src/utils/cn.ts`) for conditional/dynamic class combinations
- **Use shared utilities**: Before writing new utility functions, check `packages/shared/src/utils/` for existing implementations. Key utilities: `formatRelativeTime` (locale-aware via `Intl.RelativeTimeFormat`), `formatLocalized`, `formatDateForDatabase`, `formatTimestampForDatabase`

## Additional Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Full system architecture, API routes, testing infrastructure, database schema
- **[VERSION_MANAGEMENT.md](./docs/VERSION_MANAGEMENT.md)** - Version bumping, changelog, and release workflow
- **[Mobile PRD](./docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md)** - Mobile app plans
- **[FRIENDSHIP_SYSTEM.md](./docs/FRIENDSHIP_SYSTEM.md)** - Friendship feature documentation
