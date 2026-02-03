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
- `pnpm sup:db:reset` - Reset DB and run migrations (use this to test migrations)
- `pnpm sup:db:pull` - Pull remote DB changes
- **Note**: We don't push DB changes; we reset the local DB to test if migrations work properly
- `pnpm sup:db:types` - Generate TypeScript types from DB schema
- `pnpm sup:mig:new` - Create new migration file

### Mobile Build Commands

- `eas build --profile development --platform android` - Development build with local backend
- `eas build --profile preview --platform android` - Preview build (APK) for internal testing
- `eas build --profile production-apk --platform android` - Production environment APK for pre-release testing
- `eas build --profile production --platform android` - Production AAB for Play Store submission

**Note**: The `production-apk` profile builds an APK (not AAB) with production environment values, suitable for sharing with testers before Play Store release. It uses the "production-apk" OTA update channel to avoid conflicts with Play Store builds.

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
│       │   ├── (auth)/       # Auth screens (sign-in, sign-up, forgot-password)
│       │   ├── (tabs)/       # Main tabs (home, attendance, groups, leaderboard, profile)
│       │   ├── settings/     # Settings screens (change-password, notifications, photo-privacy)
│       │   ├── groups/       # Group detail screens ([id]/index, [id]/settings, [id]/gallery)
│       │   ├── achievements/ # Achievements screen
│       │   └── join-group/   # Join group by invite token
│       ├── components/       # React Native components
│       │   ├── ui/           # Gluestack UI components
│       │   └── [feature]/    # Feature-specific (profile, attendance, groups, etc.)
│       ├── hooks/            # Mobile-specific hooks (biometrics, image upload)
│       └── lib/              # Utilities, constants, contexts
│           ├── auth/         # AuthContext, biometrics
│           ├── constants/    # colors.ts
│           ├── festival/     # FestivalContext
│           └── data/         # query-client setup
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
- **Web**: Private layout redirects unauthenticated users to `/sign-in`
- **Mobile**: NavigationGuard component handles route protection in `_layout.tsx`

### Provider Architecture (Mobile)

The mobile app uses a nested provider structure in `apps/mobile/app/_layout.tsx`:

```
GestureHandlerRootView
└── SafeAreaProvider
    └── I18nextProvider
        └── ErrorBoundary
            └── DataProvider (TanStack React Query)
                └── ApiClientProvider
                    └── GluestackUIProvider
                        └── AuthProvider
                            └── FestivalProvider
                                └── NavigationGuard
                                    └── Stack (Expo Router)
```

**Important**: GluestackUIProvider must be inside ApiClientProvider because OverlayProvider renders modals/sheets via portal.

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

**IMPORTANT (Mobile)**: Always use Gluestack UI components and NativeWind (Tailwind classes via `className`) for styling. Do NOT use React Native `StyleSheet` or inline style objects.

## API Layer

- **Hono REST API** in `packages/api/` with OpenAPI spec generation
- **Type-safe client** auto-generated in `packages/api-client/` using `openapi-typescript` and `openapi-fetch`
- Regenerate API client:
  1. `pnpm --filter=@prostcounter/api generate-spec` - Generate OpenAPI spec from Hono routes
  2. `pnpm --filter=@prostcounter/api-client generate` - Generate TypeScript types and client from spec
- Both web and mobile use the same API client for all server communication

## Mobile-Specific Features

The mobile app includes several features not present in the web version:

1. **Biometric Authentication** (Face ID/Touch ID)
   - Hook: `useBiometrics()` in `apps/mobile/hooks/useBiometrics.ts`
   - Can be enabled/disabled in profile settings

2. **Tutorial/Onboarding System**
   - Tutorial shown on first app launch
   - Can be reset from profile settings using `useResetTutorial()`

3. **Native Image Capture**
   - Camera and photo library integration
   - Hooks: `useImageUpload()`, `useAvatarUpload()`, `useBeerPictureUpload()`
   - Component: `ImageSourcePicker` for camera/library selection

4. **Settings Screens**
   - `/settings/change-password` - Change password
   - `/settings/notifications` - Notification preferences (UI ready, API TODO)
   - `/settings/photo-privacy` - Photo visibility settings

5. **Navigation Guards**
   - Auto-redirect to sign-in for unauthenticated users
   - Protected route handling via NavigationGuard component

6. **Error Boundaries**
   - App-wide error handling with ErrorBoundary component
   - Prevents crashes from propagating

### Mobile-Specific Hooks

- `useBiometrics()` - Biometric authentication management
- `useBeerPictureUpload()` - Upload beer photos
- `useImageUpload()` - Generic image upload
- `useAvatarUpload()` - Profile avatar upload
- `useSaveAttendance()` - Save attendance with optimistic updates
- `useDrinkPrice()` - Calculate drink costs (mobile & web)

## Mobile Development Patterns

**Reference implementation**: `apps/mobile/app/(tabs)/profile.tsx`

When developing mobile screens, follow the patterns established in the profile page:

### File Structure

```typescript
// 1. External imports (grouped by package)
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCurrentProfile,
  useUpdateProfile,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  UpdateProfileSchema,
  type UpdateProfileInput,
} from "@prostcounter/shared/schemas";
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
- **Before Committing**: Always run `pnpm lint` and `pnpm type-check` on the whole project and ensure there are no errors
- **Work on Branches**: Never commit directly to main. Always create a feature branch for changes and submit via pull request
- **Do NOT Push**: Do not push commits to the remote repository unless explicitly asked
- **Production APK Testing**: Use `eas build --profile production-apk --platform android` to create a production-environment APK for testing before Play Store release. Download the APK from the EAS dashboard and share directly with testers

## Additional Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and testing guide
- **[Mobile PRD](./docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md)** - Mobile app plans
