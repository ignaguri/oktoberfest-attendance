# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProstCounter is a cross-platform app (Next.js PWA + Expo mobile) for tracking Oktoberfest and other beer festivals attendance. Users log daily beer consumption, participate in group competitions, view leaderboards, and earn achievements.

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
- `pnpm sup:db:reset` - Reset DB and run migrations (use this to test migrations)
- `pnpm sup:db:pull` - Pull remote DB changes
- **Note**: We don't push DB changes; we reset the local DB to test if migrations work properly
- `pnpm sup:db:types` - Generate TypeScript types from DB schema
- `pnpm sup:mig:new` - Create new migration file

### Test Users (Local Development)

Seed data creates users `user1@example.com` through `user10@example.com` with password `password`.

## Architecture

### Tech Stack

- **Web**: Next.js 15, React 19, TypeScript
- **Mobile**: Expo/React Native with Gluestack UI + NativeWind
- **Backend**: Supabase (auth, database, storage)
- **API**: Hono + OpenAPI (type-safe REST API in packages/api)
- **State Management**: TanStack React Query v5
- **i18n**: i18next + react-i18next (shared across web and mobile)
- **Testing**: Vitest (unit & integration tests)
- **Build System**: Turborepo (monorepo orchestration)
- **Package Manager**: pnpm

### Application Structure

```
prostcounter/
├── apps/
│   ├── web/                  # Next.js PWA
│   │   ├── app/              # App router pages
│   │   ├── components/       # React components
│   │   └── lib/              # Utilities, hooks, contexts
│   │
│   └── mobile/               # Expo React Native app
│       ├── app/              # Expo Router pages
│       ├── components/       # React Native components
│       │   ├── ui/           # Gluestack UI components
│       │   └── [feature]/    # Feature-specific components
│       ├── hooks/            # Custom hooks
│       └── lib/              # Utilities, constants, contexts
│
├── packages/
│   ├── api/                  # Hono API routes & business logic
│   ├── shared/               # Shared utilities, types, schemas, i18n, hooks
│   ├── db/                   # Database types (generated from Supabase)
│   └── api-client/           # Type-safe API client (auto-generated)
│
└── supabase/                 # Database migrations & seed data
```

### Core Data Models

- **attendances**: Daily beer count per user/date
- **tent_visits**: Location tracking with timestamps
- **beer_pictures**: Photo uploads linked to attendances
- **groups**: Competition groups with invite tokens
- **profiles**: User metadata (username, full_name, avatar)
- **festivals**: Multi-festival support (dates, cost, location)

### Key Business Logic

- **Festival Dates**: Dynamic from database via FestivalContext
- **Beer Cost**: Configurable per festival (default €16.2)
- **Competition Types**: days_attended | total_beers | avg_beers

## Important Patterns

### Authentication Flow

- Supabase Auth with Row Level Security (RLS)
- Private layout redirects unauthenticated users to `/sign-in`

### Form Validation

- **React Hook Form + Zod** for all forms
- Schemas in `packages/shared/src/schemas/`

### Internationalization (i18n)

- i18next shared between web and mobile in `packages/shared/src/i18n/`
- Use `useTranslation()` hook from `@prostcounter/shared/i18n`

### State Management

- **TanStack React Query v5** for server state
- Business logic hooks in `packages/shared/src/hooks/` (shared) and `apps/*/hooks/` (app-specific)

## Styling System

### Brand Colors (Yellow Theme)

- Primary: `yellow-500` (#F59E0B), `yellow-600` (#D97706)
- Web: shadcn/ui + Tailwind CSS
- Mobile: Gluestack UI + NativeWind

## API Layer

- **Hono REST API** in `packages/api/` with OpenAPI spec generation
- **Type-safe client** auto-generated in `packages/api-client/`
- Regenerate: `pnpm --filter=@prostcounter/api generate-spec && pnpm --filter=@prostcounter/api-client generate`

## Mobile Development Patterns

**Reference implementation**: `apps/mobile/app/(tabs)/profile.tsx`

When developing mobile screens, follow the patterns established in the profile page:

### File Structure

```typescript
// 1. External imports (grouped by package)
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurrentProfile, useUpdateProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { UpdateProfileSchema, type UpdateProfileInput } from "@prostcounter/shared/schemas";
import { useRouter } from "expo-router";
import { Lock, LogOut } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

// 2. Internal component imports
import { ProfileHeader } from "@/components/profile/profile-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";

// 3. Constants and utilities
import { Colors, IconColors } from "@/lib/constants/colors";
```

### Component Structure

```typescript
export default function ScreenName() {
  const { t } = useTranslation();
  const router = useRouter();

  // 1. Dialog/sheet state (use reusable hooks)
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // 2. Data hooks from @prostcounter/shared/hooks
  const { data, loading, error, refetch } = useSomeData();
  const mutation = useSomeMutation();

  // 3. Local UI state
  const [isEditing, setIsEditing] = useState(false);

  // 4. Form setup with `values` option (React 19 pattern - no useEffect needed)
  const { control, handleSubmit, reset, formState: { errors } } = useForm<InputType>({
    resolver: zodResolver(Schema),
    values: data ? { field: data.field || "" } : undefined,
  });

  // 5. Memoized handlers with useCallback
  const onSave = useCallback(async (data: InputType) => {
    try {
      await mutation.mutateAsync(data);
      showDialog(t("common.status.success"), t("screen.successMessage"));
    } catch {
      showDialog(t("common.status.error"), t("screen.errorMessage"));
    }
  }, [mutation, showDialog, t]);

  // 6. Loading/error states
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  // 7. Main render with VStack layout
  return (
    <ScrollView>
      <VStack space="lg" className="p-4">
        <Card size="lg" variant="elevated">
          {/* Content */}
        </Card>
      </VStack>
    </ScrollView>
  );
}
```

### Key Patterns

1. **Componentization**: Extract reusable sections to `components/[feature]/`
2. **Color constants**: Use `Colors` and `IconColors` from `@/lib/constants/colors` for icon props
3. **Icons**: Use `lucide-react-native` with `IconColors.default`, `IconColors.white`, etc.
4. **Translations**: Always use `t()` with `defaultValue` fallback for new keys
5. **Layout**: Use `VStack`/`HStack` with `space` prop instead of margin
6. **Cards**: Use `Card` component with `size` and `variant` props
7. **Forms**: Use `useForm` with `values` option (not `defaultValues` + useEffect)
8. **Dialogs**: Use `useAlertDialog` hook from alert-dialog component
9. **Accessibility**: Add `accessibilityLabel` and `accessibilityHint` to interactive elements

### Color Constants (`lib/constants/colors.ts`)

```typescript
import { Colors, IconColors, SwitchColors } from "@/lib/constants/colors";

// For icon color props
<LogOut size={20} color={IconColors.white} />
<Lock size={20} color={IconColors.default} />

// For spinner/loader colors
<ButtonSpinner color={Colors.primary[600]} />

// For Switch components
<Switch trackColor={{ false: SwitchColors.trackOff, true: SwitchColors.trackOn }} />
```

## Important Development Notes

- **Database Testing**: Always reset local DB (`pnpm sup:db:reset`) to test migrations
- **RLS Policies**: All tables have Row Level Security - test with real Supabase

## Additional Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and testing guide
- **[Mobile PRD](./docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md)** - Mobile app plans
