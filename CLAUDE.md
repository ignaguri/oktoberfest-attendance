# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Before starting any implementation task, invoke the `andrej-karpathy-skills:karpathy-guidelines` skill.

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
- **During development**: Apply migration SQL directly using the Supabase MCP `execute_sql` tool rather than `pnpm sup:db:reset` every time — a reset wipes all agents' applied migrations on the shared local instance.

### Mobile Build Commands

See **[docs/BUILDS.md](./docs/BUILDS.md)** for EAS profiles, OTA update procedure, version sync rules, and the critical `.env.local` rename step required before any EAS build or OTA push.

- `eas build --profile development --platform android` - Development build
- `eas build --profile preview --platform android` - Preview APK for internal testing
- `eas build --profile production-apk --platform android` - Production-env APK for pre-release testing
- `eas build --profile production --platform android` - Production AAB for Play Store

### Test Users (Local Development)

Seed data creates `user1@example.com` through `user10@example.com` with password `password`.

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

- **`(private)/`** - Auth-protected routes (home, attendance, groups, leaderboard, profile, admin)
- **`(public)/`** - Auth pages (sign-in, sign-up, forgot-password)
- **`(marketing)/`** - Public marketing pages and blog (no auth required)

### Styling

- **shadcn/ui + Tailwind CSS** for all web components
- Primary: `yellow-500` (#F59E0B), `yellow-600` (#D97706)

### Blog / Marketing

File-based MDX blog at `apps/web/content/blog/`. All articles must exist in `en/`, `de/`, `es/`. See **[docs/BLOG.md](./docs/BLOG.md)** for frontmatter format, MDX components, and routes.

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

1. **Componentization**: Extract reusable sections to `components/[feature]/`
2. **Translations**: Never use `defaultValue` in `t()` calls. Always add keys to **all 3 locale files** (`en.json`, `de.json`, `es.json`) with proper translations (correct umlauts for German, accents/punctuation for Spanish)
3. **Layout**: Use `VStack`/`HStack` with `space` prop instead of margin
4. **Forms**: Use `useForm` with `values` option (not `defaultValues` + useEffect)
5. **Dialogs**: Use `useAlertDialog` hook from alert-dialog component
6. **Accessibility**: Add `accessibilityLabel` and `accessibilityHint` to interactive elements

## Important Development Notes

- **RLS Policies**: All tables have Row Level Security - test with real Supabase
- **Before Committing**: Always run `pnpm lint` and `pnpm type-check` on the whole project and ensure there are no errors
- **Commit Message Title**: Max 72 characters. The pre-commit hook enforces this limit
- **Work on Branches**: Never commit directly to main. Always create a feature branch for changes and submit via pull request
- **Do NOT Push**: Do not push commits to the remote repository unless explicitly asked
- **No `defaultValue` in translations**: Never use `defaultValue` fallbacks in `t()` calls. Always add translation keys to all 3 locale files. Use proper characters: umlauts (ä, ö, ü, ß) for German, accents and inverted punctuation (á, é, í, ó, ú, ñ, ¿, ¡) for Spanish
- **No className string interpolation**: Never use template literals or string concatenation for dynamic `className` values. Use the `cn()` utility from `@prostcounter/ui` (`packages/ui/src/utils/cn.ts`)
- **Use shared utilities**: Before writing new utility functions, check `packages/shared/src/utils/` for existing implementations. Key utilities: `formatRelativeTime`, `formatLocalized`, `formatDateForDatabase`, `formatTimestampForDatabase`

## Additional Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Full system architecture, API routes, testing infrastructure, database schema
- **[BUILDS.md](./docs/BUILDS.md)** - EAS build profiles, OTA updates, version management, `.env.local` gotcha
- **[VERSION_MANAGEMENT.md](./docs/VERSION_MANAGEMENT.md)** - npm version bump, changelog, and release tag workflow
- **[BLOG.md](./docs/BLOG.md)** - Blog/MDX content authoring guide
- **[Mobile PRD](./docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md)** - Mobile app plans
- **[FRIENDSHIP_SYSTEM.md](./docs/FRIENDSHIP_SYSTEM.md)** - Friendship feature documentation
