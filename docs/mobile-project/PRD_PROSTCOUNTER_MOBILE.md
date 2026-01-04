# ProstCounter Mobile - Product Requirements Document

## Executive Summary

**ProstCounter Mobile** is a native iOS/Android app built with Expo (React Native) for tracking beer festival attendance. This PRD provides complete specifications for building the app from scratch, including a backend migration strategy and improved database schema.

### Project Goals
1. Create a native mobile app with full feature parity to the existing PWA
2. Migrate backend from Next.js server actions to shared Hono API layer
3. Fix architectural issues (beer pricing, location sharing)
4. Add native features: widgets, Apple Watch, background location, offline-first

### Key Decisions
- **Shared Backend**: Same Supabase project for web + mobile
- **API Layer**: Hono + OpenAPI deployed to Vercel (replacing Next.js server actions)
- **Architecture**: Layered (API -> Services -> Repositories) for provider flexibility
- **Database**: Improved schema with flexible drink types and derived totals
- **Offline**: Full offline support with background sync
- **Monorepo**: Turborepo with shared packages (api, api-client, shared, db)
- **i18n**: Internationalization from day one with react-i18next

---

## Part 1: Backend Architecture

### 1.1 Current State (Next.js)
The existing PWA uses Next.js server actions for all backend logic. These are incompatible with React Native. We need to migrate to a platform-agnostic API layer.

### 1.2 Target Architecture

**Stack**: Hono + OpenAPI + Zod, deployed to Vercel Serverless Functions

```
+-------------------+     +-------------------+
|   Next.js PWA     |     |   Expo Mobile     |
|  (Web Client)     |     |  (iOS/Android)    |
+---------+---------+     +---------+---------+
          |                         |
          |   Type-safe clients     |
          |   (generated from       |
          |    OpenAPI spec)        |
          |                         |
          +-----------+-------------+
                      |
          +-----------v-------------+
          |     Hono API Layer      |
          |  (Vercel Functions)     |
          |   /api/v1/...           |
          +-----------+-------------+
                      |
          +-----------v-------------+
          |    Service Layer        |
          |  (Business Logic)       |
          +-----------+-------------+
                      |
          +-----------v-------------+
          |   Repository Layer      |
          |  (Data Access)          |
          +-----------+-------------+
                      |
          +-----------v-------------+
          |    Supabase Core        |
          |  - PostgreSQL           |
          |  - Auth (JWT)           |
          |  - Storage (Images)     |
          |  - Realtime             |
          +-------------------------+
```

### 1.3 Why Hono + OpenAPI

| Feature | Benefit |
|---------|---------|
| **Hono** | Lightweight (14KB), fast, runs on any runtime (Vercel, Cloudflare, Bun) |
| **OpenAPI/Zod** | Generate type-safe clients automatically from API spec |
| **Vercel Deployment** | Seamless integration, same as existing Next.js deployment |
| **Provider Agnostic** | Repository pattern allows swapping Supabase for any database |

### 1.4 Layered Architecture

```
+-------------------------------------------------------------+
|                      API Layer (Hono)                        |
|  - Route definitions with Zod schemas                        |
|  - OpenAPI spec generation                                   |
|  - Request validation                                        |
|  - Authentication middleware                                 |
|  - Error handling                                            |
+-----------------------------+-------------------------------+
                              |
+-----------------------------v-------------------------------+
|                    Service Layer                             |
|  - Business logic (achievement evaluation, leaderboards)     |
|  - Transaction orchestration                                 |
|  - Cross-cutting concerns (notifications, caching)           |
|  - Domain validation                                         |
+-----------------------------+-------------------------------+
                              |
+-----------------------------v-------------------------------+
|                  Repository Layer                            |
|  - Data access abstraction (interfaces)                      |
|  - Supabase implementation                                   |
|  - Can swap to Prisma, Drizzle, or any ORM                  |
|  - Query building and optimization                           |
+-----------------------------+-------------------------------+
                              |
+-----------------------------v-------------------------------+
|                    Database Layer                            |
|  - Supabase PostgreSQL                                       |
|  - RLS policies for security                                 |
|  - Database functions (complex queries)                      |
+-------------------------------------------------------------+
```

### 1.5 Repository Pattern Example

```typescript
// packages/api/src/repositories/interfaces/attendance.repository.ts
export interface IAttendanceRepository {
  findByUserAndFestival(userId: string, festivalId: string): Promise<Attendance[]>;
  findByDate(userId: string, festivalId: string, date: string): Promise<Attendance | null>;
  create(data: CreateAttendanceDTO): Promise<Attendance>;
  update(id: string, data: UpdateAttendanceDTO): Promise<Attendance>;
  delete(id: string): Promise<void>;
  addConsumption(attendanceId: string, data: CreateConsumptionDTO): Promise<Consumption>;
}

// packages/api/src/repositories/supabase/attendance.repository.ts
export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByUserAndFestival(userId: string, festivalId: string): Promise<Attendance[]> {
    const { data, error } = await this.supabase
      .from('attendances')
      .select('*, consumptions(*), tent_visits(*, tent:tents(*))')
      .eq('user_id', userId)
      .eq('festival_id', festivalId)
      .order('date', { ascending: false });

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  // ... other methods
}

// Easy to swap to Prisma/Drizzle later:
// export class PrismaAttendanceRepository implements IAttendanceRepository { ... }
```

### 1.6 Service Layer Example

```typescript
// packages/api/src/services/consumption.service.ts
export class ConsumptionService {
  constructor(
    private attendanceRepo: IAttendanceRepository,
    private consumptionRepo: IConsumptionRepository,
    private festivalRepo: IFestivalRepository,
    private achievementService: AchievementService,
    private notificationService: NotificationService
  ) {}

  async logConsumption(userId: string, data: LogConsumptionInput): Promise<Attendance> {
    // 1. Get or create attendance for date
    let attendance = await this.attendanceRepo.findByDate(
      userId, data.festivalId, data.date
    );

    if (!attendance) {
      attendance = await this.attendanceRepo.create({
        userId,
        festivalId: data.festivalId,
        date: data.date,
      });
    }

    // 2. Get base price (tent override or festival default)
    const basePrice = await this.festivalRepo.getBeerPrice(data.festivalId, data.tentId);

    // 3. Add consumption record with drink type
    await this.consumptionRepo.create({
      attendanceId: attendance.id,
      tentId: data.tentId,
      drinkType: data.drinkType ?? 'beer',
      drinkName: data.drinkName,
      basePriceCents: basePrice,
      pricePaidCents: data.pricePaidCents ?? basePrice,
      volumeMl: data.volumeMl ?? 1000,
    });

    // 4. Evaluate achievements (async, non-blocking)
    this.achievementService.evaluateAsync(userId, data.festivalId);

    // 5. Send tent check-in notification to groups (only for beer/radler)
    if (data.tentId && ['beer', 'radler'].includes(data.drinkType ?? 'beer')) {
      this.notificationService.notifyTentCheckIn(userId, data.festivalId, data.tentId);
    }

    // 6. Return attendance with computed totals
    return this.attendanceRepo.findByDateWithTotals(userId, data.festivalId, data.date);
  }
}
```

### 1.7 Hono API Routes with OpenAPI

```typescript
// packages/api/src/routes/attendance.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

const DrinkTypeSchema = z.enum([
  'beer', 'radler', 'alcohol_free', 'wine', 'soft_drink', 'other'
]);

const LogConsumptionSchema = z.object({
  festivalId: z.string().uuid(),
  date: z.string().date(),
  tentId: z.string().uuid().optional(),
  drinkType: DrinkTypeSchema.default('beer'),
  drinkName: z.string().optional(),
  pricePaidCents: z.number().int().positive().optional(),
  volumeMl: z.number().int().positive().default(1000),
});

const AttendanceResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  date: z.string(),
  // Computed fields from consumptions
  drinkCount: z.number(),
  beerCount: z.number(),  // Only beer + radler
  totalSpentCents: z.number(),
  consumptions: z.array(ConsumptionSchema),
});

const logConsumptionRoute = createRoute({
  method: 'post',
  path: '/api/v1/consumption',
  tags: ['Consumption'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: LogConsumptionSchema } },
    },
  },
  responses: {
    200: {
      description: 'Attendance logged successfully',
      content: { 'application/json': { schema: AttendanceResponseSchema } },
    },
    401: { description: 'Unauthorized' },
    422: { description: 'Validation error' },
  },
});

export const attendanceRouter = new OpenAPIHono()
  .openapi(logAttendanceRoute, async (c) => {
    const user = c.get('user'); // From auth middleware
    const body = c.req.valid('json');

    const attendance = await attendanceService.logAttendance(user.id, body);
    return c.json(attendance);
  });
```

### 1.8 Type-Safe Client Generation

```bash
# Generate OpenAPI spec from Hono routes
pnpm api:generate-spec

# Generate TypeScript client from OpenAPI spec
pnpm client:generate
```

```typescript
// Auto-generated client usage (web or mobile)
import { createClient } from '@prostcounter/api-client';

const api = createClient({
  baseUrl: process.env.API_URL,
  headers: { Authorization: `Bearer ${token}` },
});

// Fully typed request/response
const attendance = await api.attendance.log({
  festivalId: 'xxx',
  date: '2025-09-20',
  tentId: 'xxx',
  pricePaidCents: 1620,
});
// attendance is typed as AttendanceResponse
```

### 1.9 API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/attendance` | POST | Log beer consumption |
| `/api/v1/attendance` | GET | List user's attendances |
| `/api/v1/attendance/:id` | DELETE | Remove attendance |
| `/api/v1/groups` | POST | Create group |
| `/api/v1/groups` | GET | List user's groups |
| `/api/v1/groups/:id` | GET | Get group details |
| `/api/v1/groups/:id/join` | POST | Join group |
| `/api/v1/groups/:id/leave` | POST | Leave group |
| `/api/v1/groups/:id/leaderboard` | GET | Group rankings |
| `/api/v1/leaderboard` | GET | Global rankings |
| `/api/v1/achievements` | GET | User's achievements |
| `/api/v1/achievements/evaluate` | POST | Trigger evaluation |
| `/api/v1/wrapped/:festivalId` | GET | Get wrapped data |
| `/api/v1/wrapped/:festivalId/generate` | POST | Generate wrapped |
| `/api/v1/reservations` | POST | Create reservation |
| `/api/v1/reservations/:id/checkin` | POST | Check in |
| `/api/v1/location/sessions` | POST | Start sharing |
| `/api/v1/location/sessions/:id` | DELETE | Stop sharing |
| `/api/v1/location/nearby` | GET | Nearby members |
| `/api/v1/notifications/token` | POST | Register FCM token |
| `/api/v1/photos/upload-url` | GET | Get signed URL |

### 1.10 Authentication Middleware

```typescript
// packages/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createClient } from '@supabase/supabase-js';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
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

## Part 1B: Monorepo Architecture (Turborepo)

### Why a Monorepo?

A monorepo allows us to:
- Share code between web (Next.js) and mobile (Expo) apps
- Share API logic, types, and schemas across all packages
- Single source of truth for database types
- Atomic commits across related changes
- Simplified dependency management

### Why Turborepo?

**Turborepo** is the ideal choice for this project:
- Simple, minimal configuration for a 2-app monorepo
- Native Vercel integration for seamless deployment
- Fast builds with remote caching (free tier available)
- Automatic dependency graph detection
- Well-suited for TypeScript monorepos

### Project Structure

```
prostcounter/
├── apps/
│   ├── web/                      # Next.js PWA (existing, migrated)
│   │   ├── app/
│   │   │   ├── api/              # Hono API routes (Vercel Functions)
│   │   │   │   └── [[...route]]/route.ts
│   │   │   ├── (private)/        # Authenticated pages
│   │   │   └── (public)/         # Public pages
│   │   ├── components/
│   │   ├── lib/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                   # Expo app (new)
│       ├── app/                  # Expo Router pages
│       │   ├── (auth)/
│       │   ├── (tabs)/
│       │   └── _layout.tsx
│       ├── components/
│       ├── lib/
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── api/                      # Shared Hono API logic
│   │   ├── src/
│   │   │   ├── index.ts          # Main Hono app export
│   │   │   ├── routes/
│   │   │   │   ├── attendance.ts
│   │   │   │   ├── groups.ts
│   │   │   │   ├── achievements.ts
│   │   │   │   ├── wrapped.ts
│   │   │   │   ├── location.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── attendance.service.ts
│   │   │   │   ├── achievement.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── index.ts
│   │   │   ├── repositories/
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── attendance.repository.ts
│   │   │   │   │   ├── festival.repository.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── supabase/
│   │   │   │       ├── attendance.repository.ts
│   │   │   │       ├── festival.repository.ts
│   │   │   │       └── index.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   └── error.ts
│   │   │   └── openapi/
│   │   │       └── spec.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/               # Generated TypeScript client
│   │   ├── src/
│   │   │   ├── client.ts         # Auto-generated from OpenAPI
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/                   # Shared utilities, types & i18n
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── attendance.ts
│   │   │   │   ├── festival.ts
│   │   │   │   ├── group.ts
│   │   │   │   ├── achievement.ts
│   │   │   │   ├── consumption.ts  # Drink types
│   │   │   │   └── index.ts
│   │   │   ├── schemas/
│   │   │   │   ├── attendance.schema.ts
│   │   │   │   ├── consumption.schema.ts
│   │   │   │   ├── group.schema.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── date.ts
│   │   │   │   ├── price.ts
│   │   │   │   ├── format.ts       # Locale-aware formatting
│   │   │   │   └── index.ts
│   │   │   ├── i18n/
│   │   │   │   ├── index.ts        # i18next config
│   │   │   │   └── types.ts        # Type-safe translations
│   │   │   └── constants/
│   │   │       └── index.ts
│   │   ├── locales/
│   │   │   ├── en.json             # English (source of truth)
│   │   │   └── de.json             # German
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/                       # Database schema & migrations
│   │   ├── supabase/
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_initial_schema.sql
│   │   │   │   ├── 0002_consumptions_table.sql
│   │   │   │   └── 0003_location_sessions.sql
│   │   │   ├── seed.sql
│   │   │   └── config.toml
│   │   ├── src/
│   │   │   └── types.ts          # Generated database types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                       # Shared UI components (optional)
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── eslint-config/            # Shared ESLint config
│       ├── base.js
│       ├── next.js
│       ├── react-native.js
│       └── package.json
│
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml           # pnpm workspaces
├── package.json                  # Root package.json
├── tsconfig.base.json            # Shared TypeScript config
└── .gitignore
```

### Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "globalEnv": [
    "NODE_ENV",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_KEY"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate-types": {
      "cache": false,
      "outputs": ["packages/db/src/types.ts"]
    },
    "api:generate-spec": {
      "dependsOn": ["^build"],
      "outputs": ["packages/api/openapi.json"]
    },
    "client:generate": {
      "dependsOn": ["api:generate-spec"],
      "outputs": ["packages/api-client/src/**"]
    }
  }
}
```

### pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root Package.json

```json
{
  "name": "prostcounter",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=@prostcounter/web",
    "dev:mobile": "turbo dev --filter=@prostcounter/mobile",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "db:generate-types": "turbo db:generate-types",
    "api:generate": "turbo api:generate-spec && turbo client:generate",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  }
}
```

### Package Dependencies

```json
// packages/api/package.json
{
  "name": "@prostcounter/api",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "generate-spec": "ts-node scripts/generate-openapi.ts"
  },
  "dependencies": {
    "@hono/zod-openapi": "^0.18.0",
    "@supabase/supabase-js": "^2.48.0",
    "hono": "^4.6.0",
    "zod": "^3.24.0",
    "@prostcounter/shared": "workspace:*",
    "@prostcounter/db": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}

// packages/shared/package.json
{
  "name": "@prostcounter/shared",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./utils": "./src/utils/index.ts",
    "./i18n": "./src/i18n/index.ts"
  },
  "dependencies": {
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}

// apps/web/package.json
{
  "name": "@prostcounter/web",
  "version": "0.1.0",
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "hono": "^4.6.0",
    "@prostcounter/api": "workspace:*",
    "@prostcounter/api-client": "workspace:*",
    "@prostcounter/shared": "workspace:*"
  }
}

// apps/mobile/package.json
{
  "name": "@prostcounter/mobile",
  "version": "0.1.0",
  "dependencies": {
    "expo": "~52.0.0",
    "react-native": "0.76.0",
    "@prostcounter/api-client": "workspace:*",
    "@prostcounter/shared": "workspace:*"
  }
}
```

### TypeScript Configuration

```json
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true
  }
}

// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Vercel Deployment Configuration

```typescript
// apps/web/app/api/[[...route]]/route.ts
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { app } from '@prostcounter/api';

export const runtime = 'edge'; // or 'nodejs' for full Node.js APIs

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
```

### Development Workflow

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Run only web app
pnpm dev:web

# Run only mobile app
pnpm dev:mobile

# Build all packages
pnpm build

# Generate database types after schema changes
pnpm db:generate-types

# Generate API client after API changes
pnpm api:generate

# Run all linting
pnpm lint

# Run type checking
pnpm type-check
```

### Remote Caching with Vercel

```bash
# Login to Vercel for remote caching
npx turbo login

# Link to your Vercel team
npx turbo link
```

This enables build caching across CI/CD and team members.

### Swapping Database Providers

The repository pattern makes it easy to swap Supabase for another provider:

```typescript
// Option 1: Keep Supabase (current)
const attendanceRepo = new SupabaseAttendanceRepository(supabase);

// Option 2: Switch to Prisma
const attendanceRepo = new PrismaAttendanceRepository(prisma);

// Option 3: Switch to Drizzle
const attendanceRepo = new DrizzleAttendanceRepository(db);

// Service layer doesn't change!
const attendanceService = new AttendanceService(attendanceRepo, ...);
```

### Client Setup (Expo)

```typescript
// apps/mobile/lib/api.ts
import { createClient } from '@prostcounter/api-client';
import { supabase } from './supabase';

export const api = createClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  getHeaders: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: session ? `Bearer ${session.access_token}` : '',
    };
  },
});
```

```typescript
// apps/mobile/lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

---

## Part 2: Database Schema (Improved)

### 2.1 Schema Changes Overview

| Change | Reason |
|--------|--------|
| Remove `profiles.custom_beer_cost` | Beer cost should not be user-configurable |
| Add `consumptions` table | Track individual beers with actual price paid |
| Remove `user_locations` table | Replace with session-based location model |
| Add `location_sessions` table | Better location sharing architecture |
| Add `location_points` table | Append-only location history |

### 2.2 Beer Pricing Model (Fixed)

**Problem**: Current system has beer costs scattered across multiple tables with no clear hierarchy.

**Solution**: Two-tier pricing only:
1. **Festival default**: `festivals.beer_cost` (e.g., EUR 16.20 for Oktoberfest 2025)
2. **Tent override**: `festival_tents.beer_price` (optional per-tent price)

**New `consumptions` table** for granular tracking with flexible drink types:

```sql
-- Drink types enum - supports all beverage varieties
CREATE TYPE drink_type AS ENUM (
  'beer',           -- Standard Oktoberfest beer (Mass)
  'radler',         -- Beer + lemonade mix
  'alcohol_free',   -- Alcohol-free beer
  'wine',           -- Wine (at Weinzelt or other venues)
  'soft_drink',     -- Non-alcoholic beverages
  'other'           -- Custom/other drinks
);

CREATE TABLE consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  tent_id UUID REFERENCES tents(id),

  -- Drink details
  drink_type drink_type NOT NULL DEFAULT 'beer',
  drink_name TEXT,  -- Optional custom name

  -- Pricing at time of consumption (immutable history)
  base_price_cents INTEGER NOT NULL,  -- From tent/festival at time of recording
  price_paid_cents INTEGER NOT NULL,  -- Actual amount paid (includes tips)
  tip_cents INTEGER GENERATED ALWAYS AS (price_paid_cents - base_price_cents) STORED,

  -- Volume tracking
  volume_ml INTEGER DEFAULT 1000,        -- 1000ml = 1 Mass, 500ml = half

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT,                  -- For safe retries

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(idempotency_key) WHERE idempotency_key IS NOT NULL
);

CREATE INDEX idx_consumptions_attendance ON consumptions(attendance_id);
CREATE INDEX idx_consumptions_recorded_at ON consumptions(recorded_at);
CREATE INDEX idx_consumptions_drink_type ON consumptions(drink_type);
```

**Calculation changes**:
- `attendance.drink_count` = `COUNT(consumptions)` (computed via view)
- `attendance.beer_count` = `COUNT(consumptions) WHERE drink_type IN ('beer', 'radler')` (computed)
- `attendance.total_spent` = `SUM(consumptions.price_paid_cents)` (computed)
- All totals are **NEVER stored** on the attendance row - use the `attendance_with_totals` view
- Remove `profiles.custom_beer_cost` column entirely

### 2.3 Location Sharing Model (Redesigned)

**Problem**: Current `user_locations` table doesn't support sessions or proper privacy controls.

**Solution**: Session-based model with append-only points:

```sql
-- Location sharing sessions
CREATE TABLE location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),

  -- Privacy
  visibility TEXT NOT NULL DEFAULT 'groups' CHECK (visibility IN ('groups', 'specific', 'none')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Who can see this session
CREATE TABLE location_session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES location_sessions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- For specific user sharing

  can_view BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT session_member_target CHECK (
    (group_id IS NOT NULL AND user_id IS NULL) OR
    (group_id IS NULL AND user_id IS NOT NULL)
  )
);

-- Append-only location points
CREATE TABLE location_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES location_sessions(id) ON DELETE CASCADE,

  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2),
  altitude DECIMAL(10, 2),
  heading DECIMAL(5, 2),
  speed DECIMAL(8, 2),

  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BRIN index for time-series queries (very efficient for append-only)
CREATE INDEX idx_location_points_recorded ON location_points
  USING BRIN (recorded_at) WITH (pages_per_range = 32);

CREATE INDEX idx_location_points_session ON location_points(session_id);
CREATE INDEX idx_location_sessions_user_festival ON location_sessions(user_id, festival_id);
CREATE INDEX idx_location_sessions_active ON location_sessions(status) WHERE status = 'active';
```

**Retention**: Location points older than 24-48 hours should be purged via scheduled job.

### 2.4 Complete Schema Reference

#### Core Tables

```sql
-- Festivals (multi-festival support)
CREATE TABLE festivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL UNIQUE,
  festival_type TEXT NOT NULL DEFAULT 'oktoberfest',

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  location TEXT NOT NULL DEFAULT 'Munich, Germany',
  map_url TEXT,

  beer_cost_cents INTEGER NOT NULL DEFAULT 1620,  -- EUR 16.20 in cents

  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT one_active_festival UNIQUE (is_active) WHERE is_active = TRUE
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,

  is_super_admin BOOLEAN DEFAULT FALSE,
  tutorial_completed BOOLEAN DEFAULT FALSE,
  tutorial_completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Beer tents (master data)
CREATE TABLE tents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('large', 'small', 'traditional')),
  capacity INTEGER,
  has_outdoor_area BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Festival-tent association with pricing
CREATE TABLE festival_tents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,

  beer_price_cents INTEGER,  -- NULL = use festival default
  is_available BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(festival_id, tent_id)
);

-- Daily attendance (header record)
-- Note: beer_count and total_spent are DERIVED from consumptions via SQL aggregation
-- We do NOT store these values to avoid data inconsistency
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  notes TEXT,  -- Optional daily notes

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, festival_id, date)
);

-- View to get attendance with computed totals
CREATE VIEW attendance_with_totals AS
SELECT
  a.*,
  COALESCE(c.drink_count, 0) AS drink_count,
  COALESCE(c.beer_count, 0) AS beer_count,
  COALESCE(c.total_spent_cents, 0) AS total_spent_cents,
  COALESCE(c.total_tip_cents, 0) AS total_tip_cents
FROM attendances a
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS drink_count,
    COUNT(*) FILTER (WHERE drink_type IN ('beer', 'radler')) AS beer_count,
    SUM(price_paid_cents) AS total_spent_cents,
    SUM(price_paid_cents - base_price_cents) AS total_tip_cents
  FROM consumptions
  WHERE attendance_id = a.id
) c ON TRUE;

-- Drink types enum
CREATE TYPE drink_type AS ENUM (
  'beer',           -- Standard Oktoberfest beer (Mass)
  'radler',         -- Beer + lemonade mix
  'alcohol_free',   -- Alcohol-free beer
  'wine',           -- Wine (at Weinzelt or other venues)
  'soft_drink',     -- Non-alcoholic beverages
  'other'           -- Custom/other drinks
);

-- Individual drink consumptions (flexible for any beverage type)
CREATE TABLE consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  tent_id UUID REFERENCES tents(id),

  -- Drink details
  drink_type drink_type NOT NULL DEFAULT 'beer',
  drink_name TEXT,  -- Optional custom name (e.g., "Spaten Oktoberfestbier", "Riesling")

  -- Pricing
  base_price_cents INTEGER NOT NULL,
  price_paid_cents INTEGER NOT NULL,
  tip_cents INTEGER GENERATED ALWAYS AS (price_paid_cents - base_price_cents) STORED,

  -- Volume tracking
  volume_ml INTEGER DEFAULT 1000,  -- 1000ml = 1 Mass, 500ml = half, 200ml = wine glass

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(idempotency_key) WHERE idempotency_key IS NOT NULL
);

-- Index for quick drink type filtering
CREATE INDEX idx_consumptions_drink_type ON consumptions(drink_type);

-- Tent visits (location tracking)
CREATE TABLE tent_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,

  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Groups & Competitions

```sql
-- Winning criteria types
CREATE TABLE winning_criteria (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('days_attended', 'total_beers', 'avg_beers')),
  display_name TEXT NOT NULL,
  description TEXT
);

INSERT INTO winning_criteria (name, display_name, description) VALUES
  ('days_attended', 'Most Days', 'Win by attending the most days'),
  ('total_beers', 'Most Beers', 'Win by drinking the most beers'),
  ('avg_beers', 'Best Average', 'Win by having the highest beers per day');

-- Competition groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  password TEXT NOT NULL,  -- Hashed

  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  winning_criteria_id INTEGER NOT NULL REFERENCES winning_criteria(id) DEFAULT 2,
  created_by UUID NOT NULL REFERENCES profiles(id),

  invite_token TEXT UNIQUE,
  token_expiration TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group membership
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(group_id, user_id)
);
```

#### Achievements

```sql
CREATE TYPE achievement_category AS ENUM (
  'consumption', 'attendance', 'explorer', 'social', 'competitive', 'special'
);

CREATE TYPE achievement_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Achievement definitions
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category achievement_category NOT NULL,
  icon TEXT NOT NULL,  -- Emoji or icon name
  points INTEGER NOT NULL DEFAULT 10,
  rarity achievement_rarity NOT NULL DEFAULT 'common',

  conditions JSONB NOT NULL,  -- Flexible condition storage
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User achievement progress
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,

  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress JSONB,  -- For progressive achievements

  UNIQUE(user_id, achievement_id, festival_id)
);

-- Achievement unlock events (for notifications)
CREATE TABLE achievement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,

  rarity achievement_rarity NOT NULL,
  user_notified_at TIMESTAMPTZ,
  group_notified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Photos & Privacy

```sql
CREATE TYPE photo_visibility AS ENUM ('public', 'private');

-- Beer pictures
CREATE TABLE beer_pictures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,

  picture_url TEXT NOT NULL,
  visibility photo_visibility NOT NULL DEFAULT 'public',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global photo privacy
CREATE TABLE user_photo_global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  hide_photos_from_all_groups BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-group photo privacy
CREATE TABLE user_group_photo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  hide_photos_from_group BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, group_id)
);
```

#### Reservations

```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id),

  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'canceled', 'completed', 'failed')),

  reminder_offset_minutes INTEGER NOT NULL DEFAULT 1440,  -- 24 hours
  reminder_sent_at TIMESTAMPTZ,
  prompt_sent_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,

  visible_to_groups BOOLEAN NOT NULL DEFAULT TRUE,
  auto_checkin BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Notifications

```sql
-- User notification preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  push_enabled BOOLEAN DEFAULT TRUE,
  reminders_enabled BOOLEAN DEFAULT TRUE,
  group_notifications_enabled BOOLEAN DEFAULT TRUE,
  achievement_notifications_enabled BOOLEAN DEFAULT TRUE,
  group_join_enabled BOOLEAN DEFAULT TRUE,
  checkin_enabled BOOLEAN DEFAULT TRUE,
  location_notifications_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limiting
CREATE TABLE notification_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_lookup ON notification_rate_limit(user_id, notification_type, group_id, created_at);

-- FCM tokens for push notifications
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, token)
);
```

#### Wrapped Data Cache

See **Part 5C: Wrapped Data Caching Strategy** for the improved caching approach using:
- Materialized views for fast aggregation (`user_festival_stats`)
- Event-driven invalidation with `wrapped_cache_metadata`
- Preview mode during festival, permanent cache after

---

## Part 3: Feature Specifications

### 3.1 Authentication

**Providers**: Email/Password, Magic Link, Apple Sign-In, Google Sign-In

**Flow**:
1. User opens app -> Check for existing session in AsyncStorage
2. If no session -> Show sign-in screen
3. On sign-in -> Store session, create/update profile
4. On sign-out -> Clear AsyncStorage, revoke session

**Screens**:
- `SignInScreen`: Email/password form, social buttons
- `SignUpScreen`: Email/password with username
- `ForgotPasswordScreen`: Reset password flow

### 3.2 Festival Selection

**Context**: `FestivalContext` provides current festival throughout app

**Auto-selection logic**:
1. Check AsyncStorage for saved preference
2. If none, find festival where `start_date <= today <= end_date`
3. If none active, select most recent `is_active = true`
4. If none, select most recent by `end_date`

**UI**: Festival picker modal accessible from header

### 3.3 Attendance Tracking

#### Quick Add (Home Screen)
- **Default**: Add 1 beer to today's count at current/selected tent
- **Inputs**: Tent selector (required), beer count increment
- **Price**: Show base price from tent/festival, optional tip input
- **Action**: Creates consumption record, updates attendance totals

#### Detailed Entry (Calendar/Attendance Screen)
- **Date picker**: Constrained to festival date range
- **Tent multi-select**: Visit multiple tents
- **Beer count**: Total for the day
- **Photos**: Attach multiple photos
- **Notes**: Optional text

#### Data Flow
```
User taps "+1 Beer"
       |
       v
Select tent (if not already)
       |
       v
Optional: Adjust price/tip
       |
       v
POST /attendance/log
       |
       v
1. Upsert attendance record for date
2. Insert consumption with price snapshot
3. Insert tent_visit if new tent
4. Update attendance totals (trigger)
5. Evaluate achievements
6. Send tent check-in notification to groups
       |
       v
Update local cache
```

### 3.4 Groups & Competitions

#### Create Group
- **Inputs**: Name, password, winning criteria, description (optional)
- **Result**: Group created, user auto-joined, invite token generated

#### Join Group
- **Methods**:
  - Scan QR code (contains invite token)
  - Enter group name + password
  - Deep link with token

#### Group Screen
- **Tabs**: Leaderboard, Gallery, Calendar, Location
- **Leaderboard**: Ranked by winning criteria, shows days/beers/avg
- **Gallery**: Photos from all members, grouped by date
- **Calendar**: Grid showing who attended which days
- **Location**: Map with member locations (if sharing)

#### Winning Criteria
| Type | Calculation |
|------|-------------|
| `days_attended` | `COUNT(DISTINCT attendances.date)` |
| `total_beers` | `SUM(attendances.beer_count)` |
| `avg_beers` | `total_beers / days_attended` |

### 3.5 Leaderboards

#### Global Leaderboard
- All festival participants ranked
- Three tabs: Days, Beers, Average
- Shows position, avatar, username, stat

#### Group Leaderboard
- Members only, ranked by group's winning criteria
- Trophy icons for top 3

### 3.6 Achievements

#### Categories
| Category | Examples |
|----------|----------|
| Consumption | 10 beers, 50 beers, 100+ beers, most in single day |
| Attendance | 3 days, 5 days, perfect attendance, every weekend |
| Explorer | 5 tents, 10 tents, all large tents, all categories |
| Social | Join group, create group, upload photo, 10 photos |
| Competitive | Top 3 in group, #1 in group, top 10 global |
| Special | First day (Early Bird), last day, same day as last year |

#### Rarity & Points
| Rarity | Points | Example |
|--------|--------|---------|
| Common | 10 | First beer, first day |
| Rare | 25 | 25 beers, 5 tents |
| Epic | 50 | 50 beers, all tents |
| Legendary | 100 | Perfect attendance, 100+ beers |

#### Progress Tracking
```typescript
interface AchievementProgress {
  achievement_id: string;
  current_value: number;
  target_value: number;
  percentage: number;
  is_unlocked: boolean;
  unlocked_at?: string;
}
```

#### Evaluation Triggers
- On attendance log/update/delete
- On tent visit
- On photo upload
- On group join
- Scheduled daily job

### 3.7 Photo Gallery

#### Upload Flow
1. User taps camera/gallery button on attendance
2. Select/capture images (max 5 per attendance)
3. Upload to Supabase Storage
4. Create beer_pictures records
5. Thumbnails generated server-side

#### Privacy Controls
- **Per-photo**: Public/private toggle
- **Global**: "Hide all my photos from groups"
- **Per-group**: "Hide my photos from this group"

#### Gallery Views
- **Personal**: Calendar with photo indicators, tap to view
- **Group**: All member photos, filterable by date/person

### 3.8 Wrapped (Year in Review)

#### Availability
- Only accessible when festival `status = 'ended'`
- Minimum attendance requirement configurable

#### Statistics Generated
```typescript
interface WrappedData {
  user_info: { username, full_name, avatar_url };
  festival_info: { name, dates, location };

  basic_stats: {
    total_beers: number;
    days_attended: number;
    avg_beers: number;
    total_spent_cents: number;
  };

  tent_stats: {
    unique_tents: number;
    favorite_tent: string;
    tent_diversity_pct: number;
    breakdown: { tent_name: string; visits: number }[];
  };

  peak_moments: {
    best_day: { date, beers, tents, spent };
    max_single_session: number;
    most_expensive_day: { date, amount };
  };

  social_stats: {
    groups_joined: number;
    top_rankings: { group_name, position }[];
    photos_uploaded: number;
  };

  global_positions: {
    days_attended: number;
    total_beers: number;
    avg_beers: number;
  };

  achievements: Achievement[];
  timeline: { date, beers, spent, tents }[];

  personality: {
    type: 'Explorer' | 'Champion' | 'Loyalist' | 'Social Butterfly' | 'Consistent' | 'Casual';
    traits: string[];
  };

  comparisons: {
    vs_festival_avg: { beers_diff_pct, days_diff_pct };
    vs_last_year?: { beers_diff, days_diff, spent_diff };
  };
}
```

#### Slides (11 screens)
1. **Intro**: Festival branding, "Your 2025 Wrapped"
2. **Numbers**: Total beers, days, spent
3. **Journey**: Daily timeline visualization
4. **Explorer**: Tent map with visited markers
5. **Peak**: Best day, record session
6. **Social**: Groups, photos, friends made
7. **Achievements**: Unlocked badges
8. **Personality**: Type reveal with traits
9. **Rankings**: Global and group positions
10. **Comparisons**: vs average, vs last year
11. **Outro**: Share buttons, next festival countdown

### 3.9 Reservations

#### Create Reservation
- **Inputs**: Tent, date/time, reminder offset, visibility
- **Validation**: Must be within festival dates, tent must exist

#### Notification Flow
```
Reservation created
       |
       v
(reminder_offset_minutes before start_at)
       |
       v
REMINDER notification: "Your reservation at {tent} is in {time}!"
       |
       v
(at start_at)
       |
       v
PROMPT notification: "Are you at {tent}? Tap to check in"
       |
       v
User taps notification -> Opens app with check-in dialog
       |
       v
User confirms -> Creates attendance + tent_visit + marks completed
```

### 3.10 Location Sharing

#### Session-Based Model
1. User starts sharing -> Creates `location_session`
2. User selects groups to share with -> Creates `location_session_members`
3. App sends location updates -> Inserts `location_points`
4. Group members can view on map
5. Session expires after 4 hours (configurable) or user stops

#### Privacy Controls
- Share with all groups vs specific groups
- Per-group notification preferences
- Auto-start on tent check-in (optional)

#### Map Features
- Real-time member locations
- Clustering for multiple members
- Distance to each member
- Last update time
- Tap member for profile quick view

### 3.11 Push Notifications

#### Notification Types
| Type | Trigger | Content |
|------|---------|---------|
| Group Join | Member joins your group | "{name} joined {group}!" |
| Tent Check-in | Group member checks into tent | "{name} is at {tent}!" |
| Achievement | User unlocks achievement | "You earned {achievement}!" |
| Achievement (Group) | Member unlocks rare+ | "{name} earned {achievement}!" |
| Reservation Reminder | Before reservation | "Your reservation is in {time}" |
| Reservation Prompt | At reservation time | "Are you at {tent}?" |
| Location Started | Member starts sharing | "{name} is sharing location" |

#### Rate Limiting
- Location notifications: 1 per user per group per 5 minutes
- Achievement (group): 1 per achievement per group per 5 minutes
- Check-in: 1 per user per tent per 30 minutes

---

## Part 4: Native Features

### 4.1 Home Screen Widgets (iOS & Android)

#### Beer Counter Widget (Small)
- Shows: Beer count, festival name
- Tap: Opens app to home screen
- Updates: Every 15 minutes or on attendance change

#### Stats Widget (Medium)
- Shows: Beers, Days, Rank in top group
- Tap: Opens leaderboard
- Updates: Hourly

#### Implementation
- **iOS**: WidgetKit with SwiftUI
- **Android**: Glance with Jetpack Compose
- **Data Sync**: App Groups (iOS) / SharedPreferences (Android)

### 4.2 Apple Watch App

#### Complications
- Beer count (all sizes)
- Days attended

#### Watch App Screens
1. **Quick Add**: Tap to add beer, select tent
2. **Today's Stats**: Beers today, total, days
3. **Leaderboard**: Top 5 in primary group

#### Sync
- WatchConnectivity framework
- Background app refresh for updates

### 4.3 Background Location

#### iOS
- Significant location changes (battery efficient)
- Background app refresh for updates
- Background processing for sync

#### Android
- Foreground service with notification
- Geofencing for tent regions (optional)

#### Battery Optimization
- Reduce update frequency when stationary
- Batch updates for sync
- Respect low power mode

### 4.4 Offline-First Architecture

#### Local Database
- **SQLite** via `expo-sqlite` or `WatermelonDB`
- Mirror of server schema for offline access
- Queue table for pending sync operations

#### Sync Strategy
```
Online Mode:
  - Write to server first, then local
  - Optimistic UI updates
  - Background sync for non-critical data

Offline Mode:
  - Write to local queue
  - Show pending indicator on items
  - Sync when connection restored

Conflict Resolution:
  - Server wins for most data
  - Merge strategy for consumptions (append)
  - User prompt for attendance conflicts
```

#### Sync Queue Schema
```typescript
interface SyncQueueItem {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  created_at: string;
  retry_count: number;
  last_error?: string;
}
```

---

## Part 5: Technical Architecture

### 5.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 52+ |
| Language | TypeScript 5.x |
| Navigation | Expo Router (file-based) |
| State | TanStack Query + Zustand |
| Forms | React Hook Form + Zod |
| UI | React Native Paper + Custom |
| Database | Supabase + expo-sqlite |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Notifications | Expo Notifications + Novu |
| Location | expo-location |
| Maps | react-native-maps |
| Charts | Victory Native |
| Animations | React Native Reanimated |

### 5.2 Project Structure (Mobile App)

```
app/
├── (auth)/                 # Auth stack (no tabs)
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   └── forgot-password.tsx
├── (tabs)/                 # Main app with bottom tabs
│   ├── index.tsx           # Home (quick add)
│   ├── calendar.tsx        # Calendar view
│   ├── groups/
│   │   ├── index.tsx       # Groups list
│   │   └── [id].tsx        # Group detail (nested tabs)
│   ├── leaderboard.tsx
│   └── profile.tsx
├── achievements/
│   └── index.tsx
├── wrapped/
│   └── index.tsx
├── reservation/
│   └── [id].tsx
└── _layout.tsx             # Root layout with providers

components/
├── ui/                     # Base UI components
├── attendance/             # Attendance-specific
├── groups/                 # Group-specific
├── achievements/           # Achievement cards, etc.
├── location/               # Map, sharing controls
└── wrapped/                # Wrapped slides

lib/
├── supabase/               # Supabase client & types
├── api/                    # API client functions
├── hooks/                  # Custom hooks
├── stores/                 # Zustand stores
├── schemas/                # Zod schemas
├── utils/                  # Utility functions
└── constants/              # App constants

db/
├── schema.ts               # Local SQLite schema
├── sync.ts                 # Sync logic
└── queue.ts                # Sync queue management
```

### 5.3 State Management

#### Server State (TanStack Query)
```typescript
// Query keys factory
const queryKeys = {
  festivals: ['festivals'] as const,
  festival: (id: string) => ['festival', id] as const,

  attendances: (festivalId: string) => ['attendances', festivalId] as const,
  attendance: (id: string) => ['attendance', id] as const,

  groups: (festivalId: string) => ['groups', festivalId] as const,
  group: (id: string) => ['group', id] as const,
  groupLeaderboard: (id: string) => ['group', id, 'leaderboard'] as const,

  achievements: (festivalId: string) => ['achievements', festivalId] as const,

  wrapped: (festivalId: string) => ['wrapped', festivalId] as const,

  nearbyMembers: (festivalId: string) => ['location', 'nearby', festivalId] as const,
};
```

#### Local State (Zustand)
```typescript
interface AppStore {
  // Festival
  currentFestivalId: string | null;
  setCurrentFestival: (id: string) => void;

  // UI
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;

  // Location sharing
  isSharing: boolean;
  sessionId: string | null;
  startSharing: (festivalId: string, groupIds: string[]) => Promise<void>;
  stopSharing: () => Promise<void>;

  // Sync
  pendingSyncCount: number;
  syncInProgress: boolean;
}
```

### 5.4 API Client Pattern

```typescript
// lib/api/attendance.ts
import { api } from '@prostcounter/api-client';

// In component using TanStack Query
const logMutation = useMutation({
  mutationFn: (params) => api.attendance.log(params),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.attendances(festivalId) });
  },
});
```

---

## Part 5B: Internationalization (i18n)

### Philosophy

Internationalization is built into the project from day one, not added later. Every user-facing string goes through the translation system, even if we only ship with English initially.

### Technology Stack

| Tool | Purpose |
|------|---------|
| **react-i18next** | React/React Native translation hooks |
| **i18next** | Core i18n framework |
| **i18next-resources-to-backend** | Lazy-load translation files |
| **Expo Localization** | Device locale detection |

### Translation Structure

Single file per language with hierarchical structure:

```
packages/shared/
├── locales/
│   ├── en.json                # English (source of truth)
│   ├── de.json                # German
│   └── es.json                # Spanish (future)
└── i18n/
    ├── index.ts               # i18next configuration
    └── types.ts               # TypeScript types for translations
```

### Translation File Example

```json
// packages/shared/locales/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "attendance": {
    "quickAdd": {
      "title": "Add Drink",
      "selectTent": "Select a tent",
      "price": "Price paid",
      "tip": "Tip included",
      "addButton": "Add {{drinkType}}",
      "success": "{{drinkType}} added to {{date}}"
    },
    "calendar": {
      "title": "My Attendance",
      "noAttendance": "No attendance recorded",
      "daysAttended": "{{count}} day attended",
      "daysAttended_plural": "{{count}} days attended"
    },
    "stats": {
      "totalDrinks": "Total Drinks",
      "totalBeers": "Total Beers",
      "totalSpent": "Total Spent",
      "averagePerDay": "Avg per Day"
    }
  },
  "drinkTypes": {
    "beer": "Beer",
    "radler": "Radler",
    "alcohol_free": "Alcohol-Free",
    "wine": "Wine",
    "soft_drink": "Soft Drink",
    "other": "Other"
  },
  "groups": {
    "create": "Create Group",
    "join": "Join Group",
    "leave": "Leave Group",
    "leaderboard": "Leaderboard"
  },
  "achievements": {
    "title": "Achievements",
    "unlocked": "Unlocked!",
    "progress": "{{current}} / {{target}}"
  },
  "wrapped": {
    "title": "Your {{year}} Wrapped",
    "generating": "Generating your wrapped..."
  },
  "errors": {
    "network": "Network error. Please try again.",
    "unauthorized": "Please sign in to continue."
  }
}
```

### i18n Configuration

```typescript
// packages/shared/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import de from '../locales/de.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: Localization.locale.split('-')[0],
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
```

### Usage in Components

```typescript
// apps/mobile/components/attendance/QuickAdd.tsx
import { useTranslation } from 'react-i18next';

export function QuickAdd() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('attendance.quickAdd.title')}</Text>
      <Select
        placeholder={t('attendance.quickAdd.selectTent')}
        options={drinkTypes.map(type => ({
          label: t(`drinkTypes.${type}`),
          value: type,
        }))}
      />
      <Button onPress={handleAdd}>
        {t('attendance.quickAdd.addButton', { drinkType: t(`drinkTypes.${selectedType}`) })}
      </Button>
    </View>
  );
}
```

### Pluralization & Formatting

```typescript
// Pluralization
t('calendar.daysAttended', { count: 5 }); // "5 days attended"
t('calendar.daysAttended', { count: 1 }); // "1 day attended"

// Number formatting (locale-aware)
const formatCurrency = (cents: number, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
};

// Date formatting
const formatDate = (date: string, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};
```

### Type Safety

```typescript
// packages/shared/i18n/types.ts
import type en from '../locales/en.json';

// Generate types from English JSON (source of truth)
type Translations = typeof en;

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Translations };
  }
}

// This gives you autocomplete for translation keys!
// t('attendance.quickAdd.title') ✓
// t('attendance.quickAdd.typo')  ✗ TypeScript error
```

### Language Switching

```typescript
// apps/mobile/components/profile/LanguageSelector.tsx
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@prostcounter/language';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  };

  return (
    <Select
      value={i18n.language}
      onChange={changeLanguage}
      options={[
        { label: 'English', value: 'en' },
        { label: 'Deutsch', value: 'de' },
      ]}
    />
  );
}
```

### Initial Language Support

| Language | Status | Notes |
|----------|--------|-------|
| English | ✅ Complete | Default, source of truth |
| German | 🔄 Planned | Primary target (Oktoberfest audience) |
| Spanish | 📋 Future | Based on user demand |

---

## Part 5C: Wrapped Data Caching Strategy

### Problem with Current Approach

The current `wrapped_data_cache` table has limitations:
- Full regeneration on every change is expensive
- No incremental updates possible
- Cache invalidation is all-or-nothing
- Stale data during festival can confuse users

### Improved Strategy: Event-Driven Incremental Computation

Instead of caching the entire wrapped JSON, we use:
1. **Materialized views** for aggregate statistics
2. **Event-driven invalidation** with selective recomputation
3. **Pre-computation during festival** with "preview mode"

### Database Design

```sql
-- Materialized view for user festival statistics (fast aggregation)
CREATE MATERIALIZED VIEW user_festival_stats AS
SELECT
  a.user_id,
  a.festival_id,
  COUNT(DISTINCT a.date) AS days_attended,
  COUNT(c.id) AS total_drinks,
  COUNT(c.id) FILTER (WHERE c.drink_type IN ('beer', 'radler')) AS total_beers,
  SUM(c.price_paid_cents) AS total_spent_cents,
  SUM(c.tip_cents) AS total_tips_cents,
  COUNT(DISTINCT tv.tent_id) AS unique_tents,
  MAX(a.date) AS last_attendance_date,
  COUNT(DISTINCT bp.id) AS photos_uploaded,
  array_agg(DISTINCT tv.tent_id) FILTER (WHERE tv.tent_id IS NOT NULL) AS visited_tent_ids
FROM attendances a
LEFT JOIN consumptions c ON c.attendance_id = a.id
LEFT JOIN tent_visits tv ON tv.user_id = a.user_id AND tv.festival_id = a.festival_id
LEFT JOIN beer_pictures bp ON bp.attendance_id = a.id
GROUP BY a.user_id, a.festival_id;

-- Unique index for fast single-user lookups
CREATE UNIQUE INDEX idx_user_festival_stats_unique
ON user_festival_stats(user_id, festival_id);

-- Index for leaderboard queries
CREATE INDEX idx_user_festival_stats_ranking
ON user_festival_stats(festival_id, total_beers DESC);

-- Cache validation tracking
CREATE TABLE wrapped_cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,

  -- Computation state
  stats_computed_at TIMESTAMPTZ,
  full_wrapped_computed_at TIMESTAMPTZ,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,

  -- Invalidation tracking
  last_attendance_change TIMESTAMPTZ,
  last_consumption_change TIMESTAMPTZ,
  last_photo_change TIMESTAMPTZ,
  requires_recompute BOOLEAN NOT NULL DEFAULT TRUE,

  -- Cached wrapped data (only stored after festival ends)
  wrapped_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, festival_id)
);

-- Trigger to mark cache as stale on changes
CREATE OR REPLACE FUNCTION mark_wrapped_stale()
RETURNS TRIGGER AS $$
BEGIN
  -- Find the festival_id based on the changed record
  UPDATE wrapped_cache_metadata wcm
  SET
    requires_recompute = TRUE,
    last_attendance_change = CASE
      WHEN TG_TABLE_NAME = 'attendances' THEN NOW()
      ELSE last_attendance_change
    END,
    last_consumption_change = CASE
      WHEN TG_TABLE_NAME = 'consumptions' THEN NOW()
      ELSE last_consumption_change
    END,
    last_photo_change = CASE
      WHEN TG_TABLE_NAME = 'beer_pictures' THEN NOW()
      ELSE last_photo_change
    END,
    updated_at = NOW()
  WHERE wcm.user_id = (
    CASE TG_TABLE_NAME
      WHEN 'attendances' THEN NEW.user_id
      WHEN 'consumptions' THEN (SELECT user_id FROM attendances WHERE id = NEW.attendance_id)
      WHEN 'beer_pictures' THEN NEW.user_id
    END
  )
  AND wcm.festival_id = (
    CASE TG_TABLE_NAME
      WHEN 'attendances' THEN NEW.festival_id
      WHEN 'consumptions' THEN (SELECT festival_id FROM attendances WHERE id = NEW.attendance_id)
      WHEN 'beer_pictures' THEN (SELECT festival_id FROM attendances WHERE id = NEW.attendance_id)
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_wrapped_stale
AFTER INSERT OR UPDATE OR DELETE ON attendances
FOR EACH ROW EXECUTE FUNCTION mark_wrapped_stale();

CREATE TRIGGER consumption_wrapped_stale
AFTER INSERT OR UPDATE OR DELETE ON consumptions
FOR EACH ROW EXECUTE FUNCTION mark_wrapped_stale();

CREATE TRIGGER photo_wrapped_stale
AFTER INSERT OR UPDATE OR DELETE ON beer_pictures
FOR EACH ROW EXECUTE FUNCTION mark_wrapped_stale();
```

### Computation Strategy

```typescript
// packages/api/src/services/wrapped.service.ts
export class WrappedService {

  /**
   * Get wrapped data with smart caching strategy:
   * 1. During festival: Always compute live (fast path via materialized view)
   * 2. After festival: Use cached data if available and not stale
   * 3. First request after festival end: Compute & cache permanently
   */
  async getWrappedData(userId: string, festivalId: string): Promise<WrappedData> {
    const festival = await this.festivalRepo.findById(festivalId);
    const isFestivalActive = festival.status !== 'ended';

    // Get cache metadata
    const cacheMetadata = await this.getCacheMetadata(userId, festivalId);

    if (isFestivalActive) {
      // During festival: Show "preview" with real-time stats
      // Uses materialized view for fast aggregation
      return this.computeLiveWrapped(userId, festivalId, { isPreview: true });
    }

    // Festival ended
    if (cacheMetadata?.is_finalized && cacheMetadata.wrapped_data) {
      // Return cached finalized data
      return cacheMetadata.wrapped_data;
    }

    // Compute and cache permanently
    const wrappedData = await this.computeFullWrapped(userId, festivalId);
    await this.finalizeCachedWrapped(userId, festivalId, wrappedData);
    return wrappedData;
  }

  /**
   * Fast live computation using materialized view
   * Used during active festival for "preview" mode
   */
  private async computeLiveWrapped(
    userId: string,
    festivalId: string,
    options: { isPreview: boolean }
  ): Promise<WrappedData> {
    // Refresh materialized view if needed (async, non-blocking)
    this.refreshStatsViewIfStale(festivalId);

    // Query from materialized view (very fast)
    const stats = await this.getStatsFromView(userId, festivalId);

    // Compute lightweight wrapped (skip expensive calculations)
    return {
      ...this.buildBasicWrapped(stats),
      isPreview: options.isPreview,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Full wrapped computation - only run after festival ends
   */
  private async computeFullWrapped(userId: string, festivalId: string): Promise<WrappedData> {
    // Run all expensive computations in parallel
    const [
      basicStats,
      tentStats,
      peakMoments,
      socialStats,
      globalPositions,
      achievements,
      timeline,
      personality,
      comparisons,
    ] = await Promise.all([
      this.computeBasicStats(userId, festivalId),
      this.computeTentStats(userId, festivalId),
      this.computePeakMoments(userId, festivalId),
      this.computeSocialStats(userId, festivalId),
      this.computeGlobalPositions(userId, festivalId),
      this.getAchievements(userId, festivalId),
      this.buildTimeline(userId, festivalId),
      this.computePersonality(userId, festivalId),
      this.computeComparisons(userId, festivalId),
    ]);

    return {
      basicStats,
      tentStats,
      peakMoments,
      socialStats,
      globalPositions,
      achievements,
      timeline,
      personality,
      comparisons,
      isPreview: false,
      generatedAt: new Date().toISOString(),
    };
  }
}
```

### Background Jobs

```typescript
// Scheduled job: Refresh materialized view during active festival
// Runs every 15 minutes during festival hours (10am - 2am Munich time)
async function refreshFestivalStats() {
  const activeFestival = await db.query(`
    SELECT id FROM festivals
    WHERE status = 'active'
    AND CURRENT_TIME BETWEEN '10:00' AND '02:00'
  `);

  if (activeFestival) {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY user_festival_stats');
  }
}

// Scheduled job: Pre-compute wrapped for all users when festival ends
// Runs once at festival.end_date + 1 day
async function precomputeAllWrapped(festivalId: string) {
  const users = await db.query(`
    SELECT DISTINCT user_id
    FROM attendances
    WHERE festival_id = $1
  `, [festivalId]);

  // Process in batches to avoid overload
  for (const batch of chunk(users, 50)) {
    await Promise.all(
      batch.map(user => wrappedService.getWrappedData(user.id, festivalId))
    );
  }
}
```

### API Endpoints

| Endpoint | During Festival | After Festival |
|----------|-----------------|----------------|
| `GET /wrapped/:festivalId` | Live preview (fast) | Cached final data |
| `POST /wrapped/:festivalId/regenerate` | N/A | Force recompute (admin) |
| `GET /wrapped/:festivalId/preview` | Live preview | Live preview (for testing) |

### Benefits of This Approach

1. **Fast during festival**: Materialized view provides sub-100ms response
2. **No unnecessary computation**: Only compute expensive parts once (after festival)
3. **Incremental invalidation**: Know exactly what changed, recompute only if needed
4. **Preview mode**: Users can see their stats building up during festival
5. **Permanent cache**: Wrapped data is immutable after festival ends
6. **Scalable**: Background refresh + batched pre-computation

---

## Part 6: Migration Plan

### Phase 1: Backend Migration (Weeks 1-2)
1. Set up Turborepo monorepo structure
2. Create Hono API package with all endpoints
3. Update database schema (new pricing model, location tables)
4. Write data migration scripts
5. Test API with existing web app
6. Gradually migrate web app to use new API client

### Phase 2: Expo Foundation (Weeks 3-4)
1. Initialize Expo app in monorepo
2. Set up navigation (Expo Router)
3. Configure Supabase client
4. Implement authentication flow
5. Set up TanStack Query + Zustand

### Phase 3: Core Features (Weeks 5-7)
1. Festival context & selection
2. Attendance tracking (quick add + detailed)
3. Groups & leaderboards
4. Basic profile

### Phase 4: Advanced Features (Weeks 8-10)
1. Achievement system
2. Photo upload & gallery
3. Reservations
4. Push notifications

### Phase 5: Location & Wrapped (Weeks 11-12)
1. Location sharing (new architecture)
2. Wrapped feature with animations
3. Share functionality

### Phase 6: Native Enhancements (Weeks 13-14)
1. Offline-first with SQLite
2. Home screen widgets
3. Apple Watch app
4. Background location

### Phase 7: Polish & Launch (Weeks 15-16)
1. Performance optimization
2. Beta testing
3. App Store submission
4. Play Store submission

---

## Part 7: Data Migration

### 7.1 Pricing Migration

```sql
-- 1. Create new consumptions from existing attendances
INSERT INTO consumptions (attendance_id, tent_id, base_price_cents, price_paid_cents, recorded_at)
SELECT
  a.id,
  tv.tent_id,
  COALESCE(ft.beer_price_cents, f.beer_cost_cents, 1620),
  COALESCE(ft.beer_price_cents, f.beer_cost_cents, 1620),  -- No tip data, use base
  tv.visit_date
FROM attendances a
CROSS JOIN LATERAL generate_series(1, a.beer_count) AS beer_num
JOIN tent_visits tv ON tv.user_id = a.user_id
  AND tv.festival_id = a.festival_id
  AND tv.visit_date::date = a.date
JOIN festivals f ON f.id = a.festival_id
LEFT JOIN festival_tents ft ON ft.festival_id = a.festival_id AND ft.tent_id = tv.tent_id
WHERE a.beer_count > 0;

-- 2. Remove custom_beer_cost from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_beer_cost;
```

### 7.2 Location Migration

```sql
-- Drop old location tables (data will be lost, but feature wasn't working)
DROP TABLE IF EXISTS location_sharing_preferences CASCADE;
DROP TABLE IF EXISTS user_locations CASCADE;

-- Create new tables (from schema above)
-- ...
```

---

## Part 8: Testing Strategy

### Unit Tests
- Business logic (price calculations, achievement evaluation)
- Zustand stores
- Utility functions

### Integration Tests
- API client functions against Supabase
- Sync queue operations
- Authentication flow

### E2E Tests (Maestro)
- Complete user journeys
- Offline scenarios
- Push notification handling

### Device Testing
- iOS Simulator + Physical devices
- Android Emulator + Physical devices
- Widget testing
- Watch app testing

---

## Appendix A: Achievement Definitions

```typescript
const achievements = [
  // Consumption
  { name: 'First Sip', category: 'consumption', rarity: 'common', points: 10,
    conditions: { type: 'threshold', target_value: 1 } },
  { name: 'Getting Started', category: 'consumption', rarity: 'common', points: 10,
    conditions: { type: 'threshold', target_value: 5 } },
  { name: 'Double Digits', category: 'consumption', rarity: 'rare', points: 25,
    conditions: { type: 'threshold', target_value: 10 } },
  { name: 'Quarter Century', category: 'consumption', rarity: 'rare', points: 25,
    conditions: { type: 'threshold', target_value: 25 } },
  { name: 'Half Century', category: 'consumption', rarity: 'epic', points: 50,
    conditions: { type: 'threshold', target_value: 50 } },
  { name: 'Century Club', category: 'consumption', rarity: 'legendary', points: 100,
    conditions: { type: 'threshold', target_value: 100 } },

  // Attendance
  { name: 'First Day', category: 'attendance', rarity: 'common', points: 10,
    conditions: { type: 'threshold', target_value: 1 } },
  { name: 'Hat Trick', category: 'attendance', rarity: 'rare', points: 25,
    conditions: { type: 'streak', min_days: 3 } },
  { name: 'Week Warrior', category: 'attendance', rarity: 'epic', points: 50,
    conditions: { type: 'streak', min_days: 7 } },
  { name: 'Festival Warrior', category: 'attendance', rarity: 'legendary', points: 100,
    conditions: { type: 'special', name: 'perfect_attendance' } },

  // Explorer
  { name: 'Tent Hopper', category: 'explorer', rarity: 'common', points: 10,
    conditions: { type: 'variety', target_value: 3 } },
  { name: 'Tent Tourist', category: 'explorer', rarity: 'rare', points: 25,
    conditions: { type: 'variety', target_value: 5 } },
  { name: 'Tent Master', category: 'explorer', rarity: 'epic', points: 50,
    conditions: { type: 'variety', target_value: 10 } },
  { name: 'Tent Legend', category: 'explorer', rarity: 'legendary', points: 100,
    conditions: { type: 'variety', target_value: 14 } },  // All large tents

  // Social
  { name: 'Team Player', category: 'social', rarity: 'common', points: 10,
    conditions: { type: 'threshold', scope: 'groups_joined', target_value: 1 } },
  { name: 'Pack Leader', category: 'social', rarity: 'rare', points: 25,
    conditions: { type: 'threshold', scope: 'groups_created', target_value: 1 } },
  { name: 'Photographer', category: 'social', rarity: 'common', points: 10,
    conditions: { type: 'threshold', scope: 'photos', target_value: 1 } },
  { name: 'Photo Master', category: 'social', rarity: 'rare', points: 25,
    conditions: { type: 'threshold', scope: 'photos', target_value: 10 } },

  // Competitive
  { name: 'Podium Finish', category: 'competitive', rarity: 'rare', points: 25,
    conditions: { type: 'special', name: 'top_3_group' } },
  { name: 'Champion', category: 'competitive', rarity: 'epic', points: 50,
    conditions: { type: 'special', name: 'first_in_group' } },

  // Special
  { name: 'Early Bird', category: 'special', rarity: 'rare', points: 25,
    conditions: { type: 'special', name: 'first_day_festival' } },
  { name: 'Last Call', category: 'special', rarity: 'rare', points: 25,
    conditions: { type: 'special', name: 'last_day_festival' } },
  { name: 'Festival Veteran', category: 'special', rarity: 'legendary', points: 100,
    conditions: { type: 'special', name: 'multi_year' } },
];
```

---

## Appendix B: Tent Data

```typescript
const tents = [
  // Large Tents (14)
  { name: 'Armbrustschuetzenzelt', category: 'large' },
  { name: 'Augustiner-Festhalle', category: 'large' },
  { name: 'Braurosl (Pschorr)', category: 'large' },
  { name: 'Fischer-Vroni', category: 'large' },
  { name: 'Hacker-Festzelt', category: 'large' },
  { name: 'Hofbrau-Festzelt', category: 'large' },
  { name: 'Kafer Wiesn-Schaenke', category: 'large' },
  { name: 'Lowenbrau-Festhalle', category: 'large' },
  { name: 'Marstall', category: 'large' },
  { name: 'Ochsenbraterei', category: 'large' },
  { name: 'Paulaner-Festhalle', category: 'large' },
  { name: 'Schottenhamel', category: 'large' },
  { name: 'Schuetzen-Festzelt', category: 'large' },
  { name: 'Weinzelt', category: 'large' },

  // Small Tents (9)
  { name: 'Cafe Kaiserschmarrn', category: 'small' },
  { name: 'Gloeckle Wirt', category: 'small' },
  { name: 'Ammer Huehner- und Entenbraterei', category: 'small' },
  { name: 'Bodos Cafezelt', category: 'small' },
  { name: 'Feisingers Kas- und Weinstueberl', category: 'small' },
  { name: 'Muenchner Knoedelei', category: 'small' },
  { name: 'Schiebls Kaffeehaferl', category: 'small' },
  { name: 'Wildstuben', category: 'small' },
  { name: 'Zum Stiftl', category: 'small' },

  // Traditional (4)
  { name: 'Herzkasperlzelt', category: 'traditional' },
  { name: 'Musikzelt', category: 'traditional' },
  { name: 'Tradition Zelt', category: 'traditional' },
  { name: 'Oide Wiesn', category: 'traditional' },
];
```

---

## Appendix C: Environment Variables

```bash
# Expo app (.env)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_API_URL=https://prostcounter.fun/api/v1

# Firebase (for push notifications)
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx
EXPO_PUBLIC_FIREBASE_APP_ID=xxx

# API package (.env)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
NOVU_API_KEY=xxx
FIREBASE_SERVICE_ACCOUNT_KEY=xxx
```

---

*Document Version: 1.1*
*Created: 2025-12-29*
*Last Updated: 2025-12-29*
*For: ProstCounter Mobile App Development*

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-29 | Initial PRD |
| 1.1 | 2025-12-29 | Removed derived columns from attendances, added drink types, i18n support, improved wrapped caching strategy, removed Nx in favor of Turborepo only |
