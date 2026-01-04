# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProstCounter is a Next.js PWA for tracking Oktoberfest and other beer festivals attendance. Users log daily beer consumption, participate in group competitions, view leaderboards, and earn achievements.

## Development Commands

### Core Development

- `pnpm dev` - Start development server at localhost:3008
- `pnpm build` - Production build
- `pnpm start` - Start production server
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix ESLint errors

### Testing Commands

- `pnpm test` - Run all tests (unit + integration)
- `pnpm test --filter=@prostcounter/api` - Run tests for specific package
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:ui` - Open Vitest UI for interactive testing

### Supabase Database Commands

- `pnpm sup:start` - Start local Supabase (requires Docker)
- `pnpm sup:stop` - Stop local Supabase
- `pnpm sup:restart` - Restart Supabase services
- `pnpm sup:db:reset` - Reset DB and run migrations (use this to test migrations)
- `pnpm sup:db:pull` - Pull remote DB changes
- **Note**: We don't push DB changes; we reset the local DB to test if migrations work properly
- `pnpm sup:db:types` - Generate TypeScript types from DB schema
- `pnpm sup:mig:new` - Create new migration file

### Test Users (Local Development)

Seed data creates users `user1@example.com` through `user10@example.com` with password `password`.

## Architecture

### Tech Stack

- **Frontend**: Next.js 15.4.6, React 19.1.1, TypeScript 5.9.2
- **Backend**: Supabase (auth, database, storage)
- **API**: Hono 4.11 + OpenAPI (type-safe REST API in packages/api)
- **State Management**: TanStack React Query v5 for server state with provider-agnostic abstraction
- **Testing**: Vitest 2.1.8 (unit & integration tests)
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **PWA**: serwist with service worker caching
- **Push Notifications**: Novu + Firebase FCM integration
- **Monitoring**: Sentry error tracking
- **Build System**: Turborepo 2.7.2 (monorepo orchestration)
- **Package Manager**: pnpm 9.15.0

### Application Structure

```
prostcounter/
├── apps/
│   └── web/                  # Next.js PWA (main application)
│       ├── app/
│       │   ├── (private)/    # Auth-protected routes
│       │   │   ├── home/     # Dashboard with quick registration
│       │   │   ├── attendance/  # Detailed attendance management
│       │   │   ├── groups/   # Group creation/management
│       │   │   ├── leaderboard/  # Global rankings
│       │   │   ├── profile/  # User settings
│       │   │   └── admin/    # Super admin panel
│       │   ├── (public)/     # Public auth pages
│       │   └── api/          # Next.js API routes
│       ├── components/       # React components
│       └── lib/              # Utilities, hooks, contexts
│
├── packages/
│   ├── api/                  # ✅ Hono API routes & business logic
│   │   ├── src/routes/       # 14 route handlers (all implemented)
│   │   ├── src/services/     # Business logic layer
│   │   ├── src/repositories/ # Data access layer (provider-agnostic)
│   │   ├── src/middleware/   # Auth, error handling
│   │   └── src/__tests__/    # ✅ Vitest test infrastructure
│   │
│   ├── shared/               # Shared utilities & types
│   │   └── src/
│   │       ├── types/        # TypeScript types
│   │       ├── schemas/      # Zod validation schemas
│   │       └── utils/        # Utility functions
│   │
│   ├── db/                   # Database schema & types
│   │   └── src/types.ts      # Generated from Supabase
│   │
│   └── api-client/           # ✅ Type-safe API client (auto-generated)
│       ├── src/index.ts      # Main client with auth injection
│       └── src/generated.ts  # Auto-generated from OpenAPI spec
│
├── supabase/                 # Supabase configuration
│   ├── migrations/           # Database migrations
│   └── seed.sql              # Test data seeding
│
└── docs/
    ├── ARCHITECTURE.md       # 📚 Architecture documentation (NEW)
    └── mobile-project/       # Future mobile app plans
```

### Core Data Models

- **attendances**: Daily beer count per user/date
- **tent_visits**: Location tracking with timestamps
- **beer_pictures**: Photo uploads linked to attendances
- **groups**: Competition groups with invite tokens
- **group_members**: User-group relationships
- **profiles**: User metadata (username, full_name, avatar)
- **user_notification_preferences**: Push notification settings per user
- **activity_feed**: View aggregating recent user activities (news feed)
- **user_locations**: Live location sharing data with expiration
- **location_sharing_preferences**: Group-based location sharing settings
- **notification_rate_limit**: Rate limiting for notification spam prevention

### Key Business Logic

- **Festival Dates**: ✅ **DYNAMIC** - Read from database via FestivalContext
- **Beer Cost**: ✅ **DYNAMIC** - Configurable per festival with fallback to €16.2
- **Competition Types**: days_attended | total_beers | avg_beers
- **Timezone**: ✅ **DYNAMIC** - Configurable per festival with fallback to Europe/Berlin

### Testing Infrastructure ✅ IMPLEMENTED

ProstCounter has comprehensive testing infrastructure using **Vitest 2.1.8** with both unit and integration tests.

#### Test Types

| Type | Location | Database | Purpose |
|------|----------|----------|---------|
| **Unit Tests** | `*.test.ts` | Mocked Supabase | HTTP layer, validation, business logic |
| **Integration Tests** | `*.integration.test.ts` | Local Supabase | End-to-end with real DB, RLS, triggers |

#### Test Helpers (packages/api/src/__tests__/helpers/)

- **`mock-supabase.ts`**: Comprehensive Supabase client mocking with chainable query builders
  - `createMockSupabase()` - Full mock client
  - `createMockChain()` - Chainable builder for specific responses
  - `mockSupabaseSuccess()` / `mockSupabaseError()` - Quick response helpers

- **`test-server.ts`**: Hono app testing utilities
  - `createTestApp()` - Mock Hono app instance
  - `createMockUser()` - Mock authenticated user
  - `createAuthRequest()` - Request with auth headers

- **`test-supabase.ts`**: Real Supabase clients for integration tests
  - `createTestSupabaseAdmin()` - Admin client (bypasses RLS)
  - `createTestSupabaseAnon()` - Anonymous client (respects RLS)
  - `createTestSupabaseWithAuth()` - Authenticated user client

#### Environment Setup

Tests automatically load environment variables from:
1. `.env.test` (if exists, for test-specific overrides)
2. `.env.local` (existing local development config)

No manual env var configuration needed for local testing!

#### Running Tests

```bash
# Prerequisites: Local Supabase must be running
pnpm sup:start

# Run all tests
pnpm test

# Run specific package tests
pnpm test --filter=@prostcounter/api

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Interactive UI
pnpm test:ui
```

#### Test Status

- ✅ **Group Routes**: 15/15 unit tests + 3/3 integration tests passing
- 🔄 **Other Routes**: Test infrastructure ready, tests pending

#### Documentation

See [packages/api/src/__tests__/README.md](../packages/api/src/__tests__/README.md) for comprehensive testing guide.

## ✅ Multi-Festival Implementation (COMPLETED)

### Database Schema ✅ IMPLEMENTED

1. **✅ `festivals` table**: id, name, start_date, end_date, beer_cost, location, map_url, is_active, status
2. **✅ `festival_id` foreign key added to**:
   - attendances (links attendance to specific festival)
   - groups (competitions per festival)
   - tent_visits (tents vary by festival year)
3. **✅ Business logic** updated to be festival-aware with FestivalContext

### Festival Data Structure

```typescript
interface Festival {
  id: string;
  name: string; // "Oktoberfest 2024", "Oktoberfest 2025"
  start_date: string; // "2024-09-21", "2025-09-20"
  end_date: string; // "2024-10-06", "2025-10-05"
  beer_cost: number; // €16.2 (may vary by year)
  location: string; // "Munich, Germany"
  map_url: string; // wiesnmap URL
  is_active: boolean; // Current festival
  status: "upcoming" | "active" | "ended";
}
```

### UI/UX Implementation ✅ COMPLETED

- **✅ Festival selector** in navbar (avatar-style circular button with modal)
- **✅ Festival-specific leaderboards** and group competitions (all data filtered by selected festival)
- **✅ Festival switching** via navbar context (FestivalProvider + FestivalContext)
- **✅ Dynamic constants** - business logic now uses festival data instead of hardcoded values
- **✅ All components** are festival-aware: home, attendance, groups, leaderboard, highlights, admin panel

### Multi-Festival Architecture Details ✅ IMPLEMENTED

- **FestivalContext**: Global React context providing selected festival state across app
- **FestivalProvider**: Root-level provider in `app/layout.tsx` with conditional authentication
- **Database Functions**: All core functions updated to accept `festival_id` parameters:
  - `get_user_festival_stats_with_positions()` - Festival-aware user stats with group positions
  - `get_global_leaderboard()` - Festival-scoped global leaderboard
  - `get_group_leaderboard()` - Group leaderboard filtered by festival
  - `join_group()` - Festival-aware group joining
- **UI Components**: All major components converted to use festival context:
  - `Highlights.tsx` - Festival-aware user statistics and group positions
  - `MyGroups.tsx` - Shows only groups from selected festival
  - `Leaderboard.tsx` - Displays festival-scoped rankings
  - `AttendancePage.tsx` - Attendance data filtered by selected festival
- **Admin Panel**: Full CRUD operations for festival management at `/admin/festivals`
- **Navbar Integration**: Festival selector as avatar-style button showing first letter + year digits

### Hardcoded Constants Migration ✅ COMPLETED

- **✅ Removed all hardcoded festival constants:**
  - `BEGINNING_OF_WIESN` (2024-09-21) → Dynamic from database
  - `END_OF_WIESN` (2024-10-06) → Dynamic from database
  - `WIESN_MAP_URL` → Dynamic from database with fallback
  - `COST_PER_BEER` → Dynamic from database with fallback
- **✅ Updated all components** to use FestivalContext instead of constants
- **✅ Implemented fallback mechanisms** for when festival data is unavailable
- **✅ Schema validation** now dynamic based on current festival dates
- **✅ Date pickers** use festival-specific min/max dates

## Gamification System Requirements ✅ COMPLETED

### Achievement Categories

1. **Attendance Streaks**: "3 days in a row", "Every weekend", "Perfect attendance"
2. **Beer Milestones**: "First beer", "10 beers total", "50+ beers", "Most in single day"
3. **Social**: "First group joined", "Group winner", "Most photos shared"
4. **Explorer**: "5+ different tents", "All tent types visited", "Early bird (first day)"
5. **Veteran**: "2+ festivals attended", "Same date both years"
6. **Special**: "Highest spender", "Photo perfectionist", "Group creator"

### Achievement System Architecture

```typescript
interface Achievement {
  id: string;
  name: string; // "Early Bird"
  description: string; // "Attended first day of festival"
  category: AchievementCategory;
  icon: string; // Emoji or icon identifier
  points: number; // Gamification points awarded
  rarity: "common" | "rare" | "epic" | "legendary";
  conditions: AchievementConditions;
}

interface UserAchievement {
  user_id: string;
  achievement_id: string;
  festival_id: string; // Festival-specific achievements
  unlocked_at: string;
  progress?: number; // For progressive achievements
}
```

### Gamification Features to Add

- **Points system** based on achievements + attendance
- **Progress bars** for trackable achievements
- **Achievement notifications** when unlocked
- **Profile badges** displaying earned achievements
- **Leaderboard integration** with achievement points
- **Achievement gallery** showing locked/unlocked status

## ✅ Push Notifications System (COMPLETED)

### Novu + Firebase FCM Integration

ProstCounter uses Novu for push notification orchestration with Firebase Cloud Messaging (FCM) for delivery. This provides cross-platform push notifications for group interactions and tent activities.

### Architecture

- **Novu**: Notification workflow orchestration and user management
- **Firebase FCM**: Cross-platform push notification delivery
- **Service Workers**: Background message handling (`/public/firebase-messaging-sw.js` + `/app/sw.ts`)
- **NotificationContext**: React context for notification state and permission management
- **Server Actions**: `lib/actions/notifications.ts` for FCM token registration

## Important Patterns

### Authentication Flow

- Supabase Auth UI for sign-up/sign-in
- Row Level Security (RLS) policies enforce data access
- Private layout redirects unauthenticated users to `/sign-in`

### Form Validation ✅ COMPLETED

- **✅ React Hook Form + Zod**: All forms migrated from Formik+Yup for better TypeScript integration and performance
- **Form Components**: Profile forms, admin forms, upload components all use React Hook Form
- **Schema Structure**: Organized in `lib/schemas/` with proper type inference
  - `lib/schemas/profile.ts` - User profile validation
  - `lib/schemas/groups.ts` - Group management validation
  - `lib/schemas/attendance.ts` - Attendance tracking validation
  - `lib/schemas/admin.ts` - Admin panel form validation
  - `lib/schemas/uploads.ts` - File upload validation
- Real-time client-side validation with server-side RLS backup

### Image Handling

- Upload to Supabase storage in `beer_pictures` bucket
- Multiple photos per attendance record

### State Management ✅ UPDATED

#### Client-Side State Management

- **TanStack React Query v5**: Server state management with caching, invalidation, and background updates
- **Provider-Agnostic Architecture**: Abstraction layer for easy migration to other solutions (react-shared-states, SWR, etc.)
- **Business Logic Hooks**: Centralized data fetching hooks in `/hooks/` directory
- **React State**: Local UI state for forms, modals, and interactions
- **Server Components**: Static data rendering where appropriate

#### Data Layer Architecture

```typescript
// Provider-agnostic interfaces
interface DataQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface DataProvider {
  useQuery: <T>(key: unknown[], fn: () => Promise<T>, options?: DataQueryOptions) => DataQueryResult<T>;
  useMutation: <TData, TVariables>(fn: (vars: TVariables) => Promise<TData>) => DataMutationResult<TData, TVariables>;
  invalidateQueries: (queryKey?: unknown[]) => void;
}
```

#### Business Logic Hooks Pattern

- **`hooks/useGroups.ts`**: Group management (create, join, leave, fetch user groups)
- **`hooks/useAchievements.ts`**: Achievement data (user achievements, available achievements)
- **`lib/data/`**: Core data abstractions and React Query provider implementation
- **Query Keys**: Centralized factory pattern for consistent cache key generation

#### Caching Strategy

- **Stale Time**: Based on data volatility (5min for user data, 1hr for static data)
- **Cache Invalidation**: Prefix-based invalidation with custom predicate matching
- **Optimistic Updates**: For mutations that affect multiple related queries
- **Background Refetching**: Automatic updates when window regains focus or network reconnects

#### Migration Benefits

- **60%+ Code Reduction**: Eliminated manual useState/useEffect patterns across 70+ files
- **Automatic Caching**: Built-in request deduplication and background updates
- **Better UX**: Loading states, error handling, and stale-while-revalidate patterns
- **TypeScript Integration**: Full type safety with schema inference
- **DevTools**: React Query DevTools for debugging cache state and performance

#### Cache Coordination

- **Server-side**: Next.js `unstable_cache` with `revalidateTag()`
- **Client-side**: React Query cache invalidation on mutations
- **Dual-layer**: Both server and client caches work together for optimal performance

#### Real-time Features

- Supabase subscriptions for live data where needed
- React Query background refetching for semi-real-time updates
- Manual cache invalidation for immediate UI updates

### Server-Side Caching Pattern ✅ IMPLEMENTED

ProstCounter uses Next.js `unstable_cache` for server-side data caching to improve performance and reduce database load.

#### Caching Architecture

```typescript
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@/lib/types";

// Cache function pattern - always private
const getCachedFunctionName = unstable_cache(
  async (param1: string, param2: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient
      .from("table_name")
      .select("*")
      .eq("column", param1);
    
    if (error) {
      reportSupabaseException("functionName", error, { id: param1 });
      throw new Error("Error message");
    }
    
    return data;
  },
  ["cache-key"], // Unique cache key
  { revalidate: 300, tags: ["cache-tag"] }, // 5 minutes cache with tags
);

// Public function that uses cached version
export async function publicFunction(param1: string) {
  const user = await getUser();
  const supabase = createClient();
  return getCachedFunctionName(user.id, param1, supabase);
}
```

#### Cache Configuration Guidelines

- **Revalidate Time**: Based on data change frequency
  - Static data (tents, winning criteria): 2-4 hours (7200-14400s)
  - User settings: 5-10 minutes (300-600s)
  - Dynamic data (attendances): No caching or very short (60s)
- **Cache Tags**: For targeted invalidation via `revalidateTag()`
- **Cache Keys**: Descriptive, unique identifiers
- **Parameters**: Always pass `SupabaseClient` as last parameter

#### Implementation Examples

- `getCachedTents` - 2 hours, static tent data
- `getCachedWinningCriterias` - 4 hours, rarely changing criteria
- `getCachedUserGroups` - 10 minutes, user group memberships
- `getCachedGlobalPhotoSettings` - 5 minutes, user photo settings

#### Cache Invalidation

```typescript
// Update actions should invalidate relevant caches
revalidateTag("cache-tag");
revalidatePath("/path");
```

**Key Benefits**: Reduced database load, improved response times, scalable performance

### Group Competition System

- Unique `invite_token` for sharing groups
- Dynamic leaderboard calculations based on `winning_criteria`
- Group galleries aggregate member photos by date

## Styling System

### Brand Colors (Yellow Theme)

- Primary: `yellow-400` (#FBBF24), `yellow-500` (#F59E0B), `yellow-600` (#D97706)
- Button variants: `yellow`, `yellowOutline`, `darkYellow`
- App title uses dual yellow gradient: "Prost" (yellow-600) + "Counter" (yellow-500)

### Component Patterns

- shadcn/ui as base component library
- Custom CSS classes: `.button`, `.card`, `.input` with yellow theming
- Mobile-first responsive design
- App name: "ProstCounter" + 🍻 emoji branding

## Priority Development Areas

1. **✅ Multi-Festival Infrastructure**: COMPLETED - Database schema and business logic updated
2. **✅ Festival Management**: COMPLETED - Admin panel with full CRUD operations for festivals
3. **✅ Historical Data**: COMPLETED - 2024 data preserved and accessible via festival switching
4. **✅ Festival Switching**: COMPLETED - Navbar UI with context-based festival navigation
5. **✅ Form System Migration**: COMPLETED - All forms migrated from Formik+Yup to React Hook Form+Zod
6. **✅ Hardcoded Constants Migration**: COMPLETED - All festival constants now dynamic from database
7. **✅ Achievement System**: COMPLETED - Full gamification system with progress tracking and automatic evaluation
8. **✅ Push Notifications**: COMPLETED - Novu integration with FCM for group join and tent check-in notifications
9. **✅ TanStack React Query Migration**: COMPLETED - Client-side state management with provider-agnostic architecture
10. **✅ News Feed & Live Location**: COMPLETED - Activity feed showing group member activities and real-time location sharing
11. **✅ Testing Infrastructure**: COMPLETED - Vitest setup with unit & integration tests (18/18 passing for group routes)
12. **✅ API-First Architecture**: COMPLETED - Hono API with auto-generated TypeScript client for Expo mobile compatibility

## Next Steps / Future Enhancements

### UI/UX Improvements

1. **✅📸 Photo Gallery Integration**: COMPLETED - Same preview functionality added to pics from gallery in the attendance table
2. **✅ Empty state for Photo gallery**: COMPLETED - Empty state for photo gallery implemented
3. **✅👤 Profile Quick Preview**: COMPLETED - Quick preview of someone else's profile from group interface
4. **✅🗞️ News Feed**: COMPLETED - Activity feed displaying group member activities (beer updates, tent check-ins, photos, achievements) from last 48 hours
5. **✅📍 Live Location Sharing**: COMPLETED - Real-time location sharing between group members with privacy controls and smart notifications

### Technical Improvements

1. **⚠️ Server Error Handling** - Properly handle server errors using Next.js error handling patterns
   - Reference: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-expected-errors-from-server-actions
2. **🔄 Expand Test Coverage** - Add tests for remaining API routes (attendance, consumption, achievements, etc.)
3. **✅ API Documentation** - COMPLETED - OpenAPI spec auto-generated from Hono routes (`pnpm --filter=@prostcounter/api generate-spec`)
4. **📱 Expo Mobile App** - React Native mobile app using `@prostcounter/api-client` for API access

## API Layer Architecture ✅ IMPLEMENTED

ProstCounter uses an **API-first architecture** with Hono REST API and auto-generated TypeScript client for full Expo mobile app compatibility.

### API Client (`packages/api-client`) ✅ COMPLETED

```typescript
// Usage in client components
import { apiClient } from "@/lib/api-client";

// Type-safe API calls with auth token injection
const groups = await apiClient.groups.list(festivalId);
const { group } = await apiClient.groups.get(groupId);
await apiClient.attendance.create({ festivalId, date, beers, tentVisits });
```

**Key Features**:
- Auto-generated from OpenAPI spec (`pnpm --filter=@prostcounter/api generate-spec`)
- Auth token automatically injected from Supabase session
- Full TypeScript type safety with request/response types
- Works in both web (Next.js) and mobile (Expo) contexts

**Regenerating the Client**:
```bash
cd packages/api
pnpm generate-spec        # Creates openapi.json

cd packages/api-client
pnpm generate             # Creates src/generated.ts
```

### Server Actions vs API Client

| Use Case | Solution | Location |
|----------|----------|----------|
| Client component data fetching | `apiClient` | `@/lib/api-client` |
| Client component mutations | `apiClient` | `@/lib/api-client` |
| Server component data fetching | Server Actions | `actions.ts` files |
| Image processing (Sharp) | Server Actions | `Avatar/actions.ts` |
| OAuth flows | Server Actions | `Auth/actions.ts` |
| Novu notifications | Server Actions | `api/join-group/actions.ts` |
| Admin-only operations | Server Actions | `admin/actions.ts` |

### Route Handlers (14 total - all implemented)

| Route | Methods | Description | Status |
|-------|---------|-------------|--------|
| `/attendance` | GET, POST, PUT, DELETE | Daily attendance records | ✅ Complete |
| `/attendance/check-in/:id` | POST | Check in from reservation | ✅ Complete |
| `/consumption` | POST | Log individual drinks | ✅ Complete |
| `/groups` | GET, POST | Create/list groups | ✅ Complete |
| `/groups/:id` | GET, PUT, DELETE | Group CRUD operations | ✅ Complete |
| `/groups/:id/join` | POST | Join group with token | ✅ Complete |
| `/groups/:id/leave` | POST | Leave group | ✅ Complete |
| `/groups/:id/leaderboard` | GET | Group rankings | ✅ Complete |
| `/groups/:id/members` | GET | List group members | ✅ Complete |
| `/groups/:id/members/:userId` | DELETE | Remove member | ✅ Complete |
| `/groups/:id/token/renew` | POST | Regenerate invite token | ✅ Complete |
| `/groups/:id/gallery` | GET | Group photo gallery | ✅ Complete |
| `/groups/join-by-token` | POST | Join with invite token | ✅ Complete |
| `/leaderboard` | GET | Global leaderboard | ✅ Complete |
| `/achievements` | GET, POST | User achievements | ✅ Complete |
| `/festivals` | GET, POST, PUT | Festival management | ✅ Complete |
| `/tents` | GET, POST, PUT | Tent management | ✅ Complete |
| `/photos` | GET, POST, DELETE | Photo uploads | ✅ Complete |
| `/reservations` | GET, POST | User reservations | ✅ Complete |
| `/reservations/:id` | GET, PUT, DELETE | Reservation CRUD | ✅ Complete |
| `/profile` | GET, PUT, DELETE | User profile management | ✅ Complete |
| `/calendar` | GET | Personal calendar events | ✅ Complete |
| `/calendar/group/:id` | GET | Group calendar events | ✅ Complete |

### Architecture Layers

```
Routes Layer (Hono)
  ↓ HTTP handlers, validation, OpenAPI schema
Services Layer
  ↓ Business logic, transaction orchestration
Repositories Layer
  ↓ Data access abstraction (provider-agnostic interfaces)
Database Layer (Supabase)
  ↓ PostgreSQL with RLS, auth, storage, realtime
```

**Key Benefits**:
- Provider-agnostic repository pattern (easy to swap Supabase for Prisma, Drizzle, etc.)
- Type-safe with Zod validation and TypeScript
- Testable with dependency injection
- OpenAPI schema generation for API documentation

## Important Development Notes

- **Migration Files**: Always use `.extensions.` prefix for migration files to ensure proper ordering
- **Database Testing**: Always reset local DB (`pnpm sup:db:reset`) to test if migrations work properly
- **No DB Push**: We don't push DB changes; we test migrations locally first
- **Test Coverage**: Write both unit tests (mocked) and integration tests (real DB) for new features
- **RLS Policies**: All tables have Row Level Security - test with real Supabase to verify

## Additional Documentation

For comprehensive architecture details, see:
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Complete system architecture, testing guide, development workflow
- **[Mobile PRD](./docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md)** - Future mobile app plans with Expo/React Native
- **[Test Documentation](./packages/api/src/__tests__/README.md)** - Testing guide with examples