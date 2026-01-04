# ProstCounter Architecture Overview

> **Current State Documentation** - Last updated: 2026-01-04
> This document describes the *implemented* architecture. For future mobile migration plans, see [PRD_PROSTCOUNTER_MOBILE.md](./mobile-project/PRD_PROSTCOUNTER_MOBILE.md).

## Table of Contents
- [Quick Reference](#quick-reference)
- [Monorepo Structure](#monorepo-structure)
- [API Layer](#api-layer)
- [Testing Infrastructure](#testing-infrastructure)
- [Database Architecture](#database-architecture)
- [Key Patterns](#key-patterns)
- [Development Workflow](#development-workflow)

---

## Quick Reference

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15.4.6 (App Router) | PWA web application |
| **API** | Hono 4.11 + OpenAPI | Type-safe REST API |
| **Database** | Supabase (PostgreSQL) | Auth, data, storage, realtime |
| **State** | TanStack Query v5 | Server state with provider-agnostic abstraction |
| **Validation** | Zod 4.2 | Runtime type validation & schemas |
| **Testing** | Vitest 2.1.8 | Unit & integration tests |
| **Build** | Turborepo 2.7.2 | Monorepo task runner |
| **Package Manager** | pnpm 9.15.0 | Workspace management |

### Essential Commands

```bash
# Development
pnpm dev                    # Run all apps in dev mode
pnpm dev:web               # Run only web app (localhost:3008)

# Database
pnpm sup:start             # Start local Supabase (Docker required)
pnpm sup:db:reset          # Reset DB and run migrations
pnpm sup:db:types          # Generate TypeScript types from schema
pnpm sup:mig:new <name>    # Create new migration

# Testing
pnpm test                  # Run all tests
pnpm test --filter=@prostcounter/api  # Test specific package
pnpm lint                  # Lint all packages
pnpm type-check            # TypeScript type checking

# Build
pnpm build                 # Build all packages
```

---

## Monorepo Structure

```
prostcounter/
├── apps/
│   └── web/                          # Next.js PWA (main application)
│       ├── app/
│       │   ├── (private)/            # Auth-protected routes
│       │   │   ├── home/             # Quick beer registration
│       │   │   ├── attendance/       # Detailed attendance management
│       │   │   ├── groups/           # Group competitions
│       │   │   ├── leaderboard/      # Global rankings
│       │   │   ├── profile/          # User settings
│       │   │   └── admin/            # Super admin panel
│       │   ├── (public)/             # Public auth pages
│       │   └── api/                  # API routes (Next.js)
│       ├── components/               # React components
│       ├── lib/                      # Utilities, hooks, contexts
│       └── package.json
│
├── packages/
│   ├── api/                          # Shared Hono API logic ✅ IMPLEMENTED
│   │   ├── src/
│   │   │   ├── index.ts              # Main Hono app export
│   │   │   ├── routes/               # 14 route handlers (✅ complete)
│   │   │   │   ├── achievement.route.ts
│   │   │   │   ├── attendance.route.ts
│   │   │   │   ├── calendar.route.ts
│   │   │   │   ├── consumption.route.ts
│   │   │   │   ├── festival.route.ts
│   │   │   │   ├── group.route.ts
│   │   │   │   ├── leaderboard.route.ts
│   │   │   │   ├── location.route.ts
│   │   │   │   ├── notification.route.ts
│   │   │   │   ├── photo.route.ts
│   │   │   │   ├── profile.route.ts
│   │   │   │   ├── reservation.route.ts
│   │   │   │   ├── tent.route.ts
│   │   │   │   └── wrapped.route.ts
│   │   │   ├── services/             # Business logic layer
│   │   │   │   ├── attendance.service.ts
│   │   │   │   ├── achievement.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── group.service.ts
│   │   │   ├── repositories/         # Data access layer
│   │   │   │   ├── interfaces/       # Repository contracts
│   │   │   │   └── supabase/         # Supabase implementations
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT authentication
│   │   │   │   └── error.ts          # Error handling
│   │   │   ├── schemas/              # Zod validation schemas
│   │   │   └── __tests__/            # ✅ NEW: Test infrastructure
│   │   │       ├── helpers/
│   │   │       │   ├── mock-supabase.ts
│   │   │       │   ├── test-server.ts
│   │   │       │   └── test-supabase.ts
│   │   │       ├── setup.ts
│   │   │       └── README.md
│   │   ├── vitest.config.ts          # ✅ NEW: Vitest configuration
│   │   └── package.json
│   │
│   ├── api-client/                   # ✅ TypeScript API client
│   │   └── src/index.ts              # Fetch-based client with auth
│   │
│   ├── shared/                       # Shared utilities & types
│   │   ├── src/
│   │   │   ├── types/                # TypeScript types
│   │   │   ├── schemas/              # Zod schemas
│   │   │   └── utils/                # Utility functions
│   │   └── package.json
│   │
│   ├── db/                           # Database schema & types
│   │   ├── src/
│   │   │   └── types.ts              # Generated from Supabase
│   │   └── package.json
│   │
│   └── eslint-config/                # Shared ESLint config
│       └── base.js
│
├── supabase/                         # Supabase configuration
│   ├── migrations/                   # Database migrations
│   ├── seed.sql                      # Test data seeding
│   └── config.toml
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md               # This file
│   ├── mobile-project/
│   │   └── PRD_PROSTCOUNTER_MOBILE.md
│   └── progress/
│
├── turbo.json                        # Turborepo configuration
├── pnpm-workspace.yaml               # pnpm workspaces
└── package.json                      # Root package.json
```

### Package Dependencies

```
@prostcounter/web
├─> @prostcounter/api        (Hono routes for API endpoints)
├─> @prostcounter/shared     (Types, schemas, utils)
└─> @prostcounter/db         (Database types)

@prostcounter/api
├─> @prostcounter/shared     (Shared types & schemas)
└─> @prostcounter/db         (Database types)

@prostcounter/shared
└─> (no internal dependencies)

@prostcounter/db
└─> (no internal dependencies)
```

---

## API Layer

### Architecture: Layered Design

The API follows a strict layered architecture for maintainability and testability:

```
┌─────────────────────────────────────────────────┐
│         Routes Layer (Hono)                     │
│  - HTTP handlers                                │
│  - Request validation (Zod)                     │
│  - OpenAPI schema definition                    │
│  - Auth middleware                              │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│         Services Layer                          │
│  - Business logic                               │
│  - Transaction orchestration                    │
│  - Achievement evaluation                       │
│  - Cross-cutting concerns                       │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│         Repositories Layer                      │
│  - Data access abstraction (interfaces)         │
│  - Supabase implementation                      │
│  - Query building & optimization                │
│  - Provider-agnostic (can swap to Prisma, etc.) │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│         Database Layer (Supabase)               │
│  - PostgreSQL with RLS                          │
│  - Auth (JWT tokens)                            │
│  - Storage (images)                             │
│  - Realtime subscriptions                       │
└─────────────────────────────────────────────────┘
```

### Implemented Routes (14 route files, 50+ endpoints)

| Route | Methods | Description | Status |
|-------|---------|-------------|--------|
| **`/achievements`** | GET, POST | User achievements & evaluation | ✅ Complete |
| **`/attendance`** | GET, POST, PUT, DELETE | Daily attendance records | ✅ Complete |
| **`/calendar`** | GET | Calendar events (personal & group) | ✅ Complete |
| **`/consumption`** | POST | Log individual drinks | ✅ Complete |
| **`/festivals`** | GET, POST, PUT | Festival management | ✅ Complete |
| **`/groups`** | GET, POST, PUT | Create/list/update groups | ✅ Complete |
| **`/groups/:id/join`** | POST | Join group with token | ✅ Complete |
| **`/groups/:id/leave`** | POST | Leave group | ✅ Complete |
| **`/groups/:id/leaderboard`** | GET | Group rankings | ✅ Complete |
| **`/groups/:id/members`** | GET, DELETE | Group member management | ✅ Complete |
| **`/groups/:id/gallery`** | GET | Group photo gallery | ✅ Complete |
| **`/leaderboard`** | GET | Global leaderboard | ✅ Complete |
| **`/location`** | GET, POST, DELETE | Location sharing sessions | ✅ Complete |
| **`/notifications`** | GET, POST | Push notifications & tokens | ✅ Complete |
| **`/photos`** | GET, POST, DELETE | Photo uploads with signed URLs | ✅ Complete |
| **`/profile`** | GET, PUT, DELETE | User profile management | ✅ Complete |
| **`/reservations`** | GET, POST, PUT, DELETE | Tent reservations & check-in | ✅ Complete |
| **`/tents`** | GET, POST, PUT | Tent management | ✅ Complete |
| **`/wrapped/:festivalId`** | GET, POST | Year-end summary | ✅ Complete |

### Repository Pattern Example

```typescript
// packages/api/src/repositories/interfaces/group.repository.ts
export interface IGroupRepository {
  findById(id: string): Promise<Group | null>;
  findByUser(userId: string, festivalId: string): Promise<Group[]>;
  create(data: CreateGroupDTO): Promise<Group>;
  addMember(groupId: string, userId: string): Promise<void>;
  isMember(groupId: string, userId: string): Promise<boolean>;
}

// packages/api/src/repositories/supabase/group.repository.ts
export class SupabaseGroupRepository implements IGroupRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Group | null> {
    const { data, error } = await this.supabase
      .from('groups')
      .select('*, winning_criteria(*)')
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new DatabaseError(error.message);
    return this.mapToGroup(data);
  }

  // ... other methods
}
```

### Authentication Flow

```typescript
// packages/api/src/middleware/auth.ts
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization' });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new HTTPException(401, { message: 'Invalid token' });
  }

  c.set('user', user);
  c.set('supabase', supabase); // Authenticated client for RLS
  await next();
});
```

---

## Testing Infrastructure

### Overview

✅ **NEW (2025-12-30)**: Comprehensive testing setup with Vitest, including unit tests and integration tests against local Supabase.

### Test Types

| Type | Location | Purpose | Database |
|------|----------|---------|----------|
| **Unit Tests** | `*.test.ts` | HTTP layer, validation, business logic | Mocked Supabase |
| **Integration Tests** | `*.integration.test.ts` | End-to-end with real DB | Local Supabase |

### Test Helpers

```typescript
// packages/api/src/__tests__/helpers/

// 1. mock-supabase.ts - Unit test mocking
export function createMockSupabase(): SupabaseClient<Database>;
export function createMockChain(result: { data: any; error: any });
export function mockSupabaseSuccess(data: any);
export function mockSupabaseError(message: string);

// 2. test-server.ts - Hono app mocking
export function createTestApp(): Hono;
export function createMockUser(): User;
export function createAuthRequest(url: string, options?: RequestInit);

// 3. test-supabase.ts - Real Supabase clients
export function createTestSupabaseAdmin(): SupabaseClient<Database>;
export function createTestSupabaseAnon(): SupabaseClient<Database>;
export function createTestSupabaseWithAuth(token: string): SupabaseClient<Database>;
```

### Environment Setup

Tests automatically load environment variables from:
1. `.env.test` (if exists, for test-specific overrides)
2. `.env.local` (existing local development config)

No need to manually set env vars for local testing!

### Running Tests

```bash
# Run all tests (unit + integration)
pnpm --filter=@prostcounter/api test

# Run only unit tests
pnpm --filter=@prostcounter/api test group.route.test.ts

# Run only integration tests (requires local Supabase)
pnpm --filter=@prostcounter/api test group.route.integration.test.ts

# Watch mode
pnpm --filter=@prostcounter/api test:watch

# Coverage
pnpm --filter=@prostcounter/api test:coverage

# UI mode
pnpm --filter=@prostcounter/api test:ui
```

### Test Status (packages/api)

- ✅ **Group Routes**: 15/15 unit tests + 3/3 integration tests passing
- 🔄 **Other Routes**: Test infrastructure ready, tests pending

### Writing Tests

See [packages/api/src/__tests__/README.md](../packages/api/src/__tests__/README.md) for comprehensive testing guide.

---

## Database Architecture

### Multi-Festival Support ✅ Implemented

The database supports multiple festivals with dynamic configuration:

```typescript
interface Festival {
  id: string;
  name: string;              // "Oktoberfest 2024", "Oktoberfest 2025"
  start_date: string;
  end_date: string;
  beer_cost: number;         // Default price in cents (€16.20 = 1620)
  location: string;
  map_url: string;
  timezone: string;          // "Europe/Berlin"
  is_active: boolean;        // Only one can be active
  status: "upcoming" | "active" | "ended";
}
```

All business logic reads from the database - no hardcoded constants!

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| **festivals** | Festival definitions | Multi-year support, dynamic pricing |
| **profiles** | User metadata | Extends Supabase auth.users |
| **attendances** | Daily attendance records | Per festival, date unique constraint |
| **consumptions** | Individual drink records | Flexible drink types, price history |
| **tent_visits** | Location tracking | Visit timestamps per tent |
| **groups** | Competition groups | Festival-scoped, invite tokens |
| **group_members** | Group membership | User-group relationships |
| **achievements** | Achievement definitions | Categories, rarity, conditions (JSONB) |
| **user_achievements** | Unlocked achievements | Per user per festival |
| **beer_pictures** | Photo uploads | Linked to attendances |
| **tents** | Tent master data | Categories, capacity |
| **festival_tents** | Festival-tent association | Per-tent pricing overrides |

### Flexible Drink Types

```typescript
type DrinkType =
  | 'beer'           // Standard Oktoberfest beer (Mass)
  | 'radler'         // Beer + lemonade mix
  | 'alcohol_free'   // Alcohol-free beer
  | 'wine'           // Wine (at Weinzelt)
  | 'soft_drink'     // Non-alcoholic beverages
  | 'other';         // Custom drinks

// consumptions table
interface Consumption {
  attendance_id: string;
  drink_type: DrinkType;
  drink_name?: string;       // Optional custom name
  base_price_cents: number;  // Price at time of recording
  price_paid_cents: number;  // Actual amount (includes tip)
  volume_ml: number;         // 1000ml = 1 Mass, 500ml = half
}
```

### Computed vs Stored Data

**Important**: Beer counts and totals are **computed** from consumptions, not stored:

```sql
-- View for attendance with totals (use this for queries!)
CREATE VIEW attendance_with_totals AS
SELECT
  a.*,
  COUNT(c.id) AS drink_count,
  COUNT(c.id) FILTER (WHERE c.drink_type IN ('beer', 'radler')) AS beer_count,
  SUM(c.price_paid_cents) AS total_spent_cents
FROM attendances a
LEFT JOIN consumptions c ON c.attendance_id = a.id
GROUP BY a.id;
```

Never query `attendances` directly - always use `attendance_with_totals`!

### Row Level Security (RLS)

All tables have RLS policies enforcing:
- Users can only read/write their own data
- Groups can read member data based on membership
- Super admins bypass all restrictions
- Service role (API) uses policies for data isolation

### Database Migrations

```bash
# Create new migration
pnpm sup:mig:new <descriptive-name>

# Apply migrations (local)
pnpm sup:db:reset

# Generate TypeScript types
pnpm sup:db:types

# Pull remote schema (for reference)
pnpm sup:db:pull
```

**Important**: Always use `.extensions.` prefix for migration files to ensure proper ordering.

---

## Key Patterns

### 1. Provider-Agnostic Repository Pattern

The repository layer uses interfaces to allow swapping database providers:

```typescript
// Easy to swap Supabase for another provider
const repo = new SupabaseGroupRepository(supabase);  // Current
// const repo = new PrismaGroupRepository(prisma);   // Future option
// const repo = new DrizzleGroupRepository(db);      // Future option

// Service layer doesn't change!
const groupService = new GroupService(repo);
```

### 2. Error Handling Hierarchy

```typescript
// Custom error classes with proper HTTP status mapping
export class DatabaseError extends Error { status = 500; }
export class NotFoundError extends Error { status = 404; }
export class ValidationError extends Error { status = 422; }
export class UnauthorizedError extends Error { status = 401; }
export class ForbiddenError extends Error { status = 403; }

// Error middleware maps to HTTP responses
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  // ... handle custom errors
};
```

### 3. Server-Side Caching

Next.js `unstable_cache` for performance:

```typescript
const getCachedTents = unstable_cache(
  async (festivalId: string, supabase: SupabaseClient) => {
    const { data, error } = await supabase
      .from('tents')
      .select('*')
      .eq('festival_id', festivalId);

    if (error) throw new DatabaseError(error.message);
    return data;
  },
  ['tents'],
  { revalidate: 7200, tags: ['tents'] } // 2 hours
);
```

### 4. Client-Side State Management

**TanStack Query v5** with provider-agnostic architecture:

```typescript
// Business logic hooks centralized in /hooks
export function useGroups(festivalId: string) {
  return useQuery({
    queryKey: ['groups', festivalId],
    queryFn: () => fetchUserGroups(festivalId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Easy to migrate to other solutions (react-shared-states, SWR, etc.)
```

### 5. Form Validation (React Hook Form + Zod)

All forms use React Hook Form with Zod schemas:

```typescript
const schema = z.object({
  name: z.string().min(3).max(50),
  festivalId: z.string().uuid(),
  winningCriteriaId: z.number().int().positive(),
});

type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

---

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd prostcounter

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start local Supabase (requires Docker)
pnpm sup:start

# Generate database types
pnpm sup:db:types

# Start development server
pnpm dev:web  # Opens at http://localhost:3008
```

### Daily Development

```bash
# Start services
pnpm sup:start          # Start Supabase (if not running)
pnpm dev:web            # Start Next.js dev server

# Make changes...

# Testing
pnpm test               # Run all tests
pnpm lint               # Check code quality
pnpm type-check         # TypeScript validation

# Database changes
pnpm sup:mig:new <name> # Create migration
pnpm sup:db:reset       # Apply migrations
pnpm sup:db:types       # Regenerate types
```

### Git Workflow

```bash
# Feature branches
git checkout -b feature/<feature-name>

# Make changes and commit
git add .
git commit -m "feat: description"

# Pre-commit hooks run automatically:
# - ESLint auto-fix
# - Type checking
# - Tests

# Push to remote
git push origin feature/<feature-name>
```

### Turborepo Task Pipeline

```
build
  ├─> @prostcounter/db:build        (generate types)
  ├─> @prostcounter/shared:build    (compile TypeScript)
  ├─> @prostcounter/api:build       (compile TypeScript)
  └─> @prostcounter/web:build       (Next.js build)

lint
  └─> All packages in parallel

type-check
  └─> All packages in parallel

test
  └─> All packages in parallel
```

### Environment Variables

**Required** (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

**Optional**:
```bash
# OAuth (production only)
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET=

# Novu (push notifications)
NEXT_PUBLIC_NOVU_APP_ID=
NOVU_API_KEY=

# Firebase (FCM push notifications)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
# ... etc

# Logging
LOG_LEVEL=DEBUG
LOG_FORMAT=json
```

---

## Status & Roadmap

### ✅ Completed Features

- **Multi-Festival Architecture**: Dynamic festivals from database
- **API Layer**: 14 route files with 50+ endpoints, full CRUD operations
- **API Client**: Type-safe fetch-based client with Supabase auth integration
- **Testing Infrastructure**: Vitest setup with unit & integration tests
- **Group Competitions**: Create, join, leaderboards, galleries, member management
- **Achievement System**: Gamification with categories and rarity
- **Photo Gallery**: Upload with signed URLs and privacy controls
- **Location Sharing**: Real-time location with session management
- **Push Notifications**: Novu + FCM integration
- **Wrapped**: Year-end summary with 11 slides
- **Calendar & Reservations**: Tent reservations with check-in functionality
- **Admin Panel**: Super admin management interface

### 🔄 In Progress

- **Test Coverage**: Expanding tests to all routes (group routes complete)
- **Mobile App**: Expo app foundation (Phase 6 of migration plan)

### 📋 Planned (Mobile Migration)

See [PRD_PROSTCOUNTER_MOBILE.md](./mobile-project/PRD_PROSTCOUNTER_MOBILE.md) for:
- Expo (React Native) mobile app
- Offline-first architecture
- Native features (widgets, Apple Watch, background location)
- Improved location sharing model

---

## Additional Resources

- **Project Instructions**: [CLAUDE.md](../CLAUDE.md)
- **Mobile PRD**: [docs/mobile-project/PRD_PROSTCOUNTER_MOBILE.md](./mobile-project/PRD_PROSTCOUNTER_MOBILE.md)
- **Test Documentation**: [packages/api/src/__tests__/README.md](../packages/api/src/__tests__/README.md)
- **Database Migrations**: [supabase/migrations/](../supabase/migrations/)
- **Progress Tracking**: [docs/progress/](./progress/)

---

## Contributing

1. Follow the established patterns (repository → service → route)
2. Write tests for new features (unit + integration)
3. Update TypeScript types when changing database schema
4. Use Zod schemas for all validation
5. Add JSDoc comments for public APIs
6. Keep commits atomic and well-described

---

*Last updated: 2026-01-04*
*Document version: 1.1*
