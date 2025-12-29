# ProstCounter Mobile - Implementation Progress

**Start Date**: 2025-12-29
**Timeline**: 16 weeks
**Current Phase**: Phase 1 - Monorepo Foundation & Setup

---

## Progress Overview

| Phase | Status | Completion | Timeline |
|-------|--------|------------|----------|
| Phase 1: Monorepo Foundation | 🔄 In Progress | 0% | Week 1 |
| Phase 2: Hono API Package | ⏳ Pending | 0% | Week 1-2 |
| Phase 3: Database Migration | ⏳ Pending | 0% | Week 2 |
| Phase 4: Hono API Routes | ⏳ Pending | 0% | Week 2-3 |
| Phase 5: Web App Migration | ⏳ Pending | 0% | Week 3-4 |
| Phase 6: Expo App Foundation | ⏳ Pending | 0% | Week 5-6 |
| Phase 7: Core Mobile Features | ⏳ Pending | 0% | Week 6-8 |
| Phase 8: Advanced Features | ⏳ Pending | 0% | Week 9-11 |
| Phase 9: Native Enhancements | ⏳ Pending | 0% | Week 12-14 |
| Phase 10: Internationalization | ⏳ Pending | 0% | Week 14 |
| Phase 11: Testing & Quality | ⏳ Pending | 0% | Week 15 |
| Phase 12: Polish & Launch | ⏳ Pending | 0% | Week 16 |

**Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ⚠️ Blocked | ❌ Failed

---

## Phase 1: Monorepo Foundation & Setup (Week 1)

**Goal**: Convert single Next.js app to Turborepo monorepo structure

### 1.1 Initialize Turborepo Monorepo

- [ ] **Create Turborepo configuration** (`turbo.json`)
  - Status: Pending
  - Started: -
  - Completed: -

- [ ] **Set up pnpm workspaces** (`pnpm-workspace.yaml`)
  - Status: Pending
  - Started: -
  - Completed: -

- [ ] **Create package structure**
  - [ ] `packages/api/package.json`
  - [ ] `packages/shared/package.json`
  - [ ] `packages/db/package.json`
  - [ ] `packages/api-client/package.json`
  - [ ] `packages/eslint-config/package.json`
  - Status: Pending
  - Started: -
  - Completed: -

- [ ] **Create root TypeScript config** (`tsconfig.base.json`)
  - Status: Pending
  - Started: -
  - Completed: -

- [ ] **Restructure Next.js app into `apps/web/`**
  - Status: Pending
  - Started: -
  - Completed: -
  - Notes: Move all existing files from root to apps/web/

- [ ] **Move shared code to packages**
  - [ ] `lib/database.types.ts` → `packages/db/src/types.ts`
  - [ ] `lib/schemas/` → `packages/shared/src/schemas/`
  - [ ] `lib/utils/` → `packages/shared/src/utils/`
  - Status: Pending
  - Started: -
  - Completed: -

- [ ] **Update path aliases and imports**
  - Status: Pending
  - Started: -
  - Completed: -
  - Notes: Update all imports to use workspace references

- [ ] **Test monorepo builds**
  - [ ] Run `pnpm build` at root
  - [ ] Verify web app still runs with `pnpm dev --filter=@prostcounter/web`
  - Status: Pending
  - Started: -
  - Completed: -

### Phase 1 Completion Checklist
- [ ] Monorepo structure created
- [ ] All packages have valid package.json
- [ ] Turborepo builds successfully
- [ ] Web app runs in monorepo context
- [ ] No broken imports or type errors
- [ ] Git branch created and initial changes committed

---

## Phase 2: Hono API Package Setup (Week 1-2)

**Goal**: Set up Hono API with OpenAPI spec generation

### 2.1 Create Hono API Infrastructure

- [ ] **Install Hono dependencies**
  - [ ] `hono`
  - [ ] `@hono/zod-openapi`
  - [ ] `@hono/zod-validator`
  - Status: Pending

- [ ] **Create layered architecture**
  - [ ] `packages/api/src/index.ts` - Main Hono app
  - [ ] `packages/api/src/routes/` - API routes
  - [ ] `packages/api/src/services/` - Business logic
  - [ ] `packages/api/src/repositories/` - Data access
  - [ ] `packages/api/src/middleware/` - Auth, error handling
  - Status: Pending

- [ ] **Set up OpenAPI spec generation**
  - [ ] Create `packages/api/scripts/generate-openapi.ts`
  - [ ] Add npm script: `api:generate-spec`
  - Status: Pending

- [ ] **Create authentication middleware**
  - [ ] Supabase JWT validation
  - [ ] User extraction from token
  - [ ] Rate limiting
  - Status: Pending

- [ ] **Create error handling middleware**
  - [ ] Global error handler
  - [ ] Zod validation errors
  - [ ] Database errors
  - Status: Pending

- [ ] **Set up TypeScript client generation**
  - [ ] Install `openapi-typescript-codegen`
  - [ ] Add npm script: `client:generate`
  - Status: Pending

### 2.2 Zod Schema Migration

- [ ] **Move schemas to shared package**
  - [ ] `attendance.schema.ts`
  - [ ] `consumption.schema.ts` (NEW)
  - [ ] `group.schema.ts`
  - [ ] `achievement.schema.ts`
  - [ ] `location.schema.ts` (NEW - session-based)
  - [ ] `notification.schema.ts`
  - Status: Pending

- [ ] **Create drink type enum**
  - [ ] Define: beer, radler, alcohol_free, wine, soft_drink, other
  - Status: Pending

- [ ] **Add OpenAPI decorators**
  - [ ] Route schemas with metadata
  - [ ] Request/response validation
  - Status: Pending

### Phase 2 Completion Checklist
- [ ] Hono app exports successfully
- [ ] OpenAPI spec generates without errors
- [ ] TypeScript client generates from spec
- [ ] All schemas moved to shared package
- [ ] Middleware functions tested

---

## Phase 3: Database Schema Migration (Week 2)

**Goal**: Implement consumption tracking and new location model

### 3.1 Create New Database Tables

- [ ] **Create migration: drink_type enum**
  - File: `supabase/migrations/YYYYMMDD_create_drink_type_enum.sql`
  - Status: Pending

- [ ] **Create migration: consumptions table**
  - File: `supabase/migrations/YYYYMMDD_create_consumptions_table.sql`
  - Includes: id, attendance_id, tent_id, drink_type, drink_name, base_price_cents, price_paid_cents, tip_cents, volume_ml, recorded_at, idempotency_key
  - Status: Pending

- [ ] **Create migration: attendance_with_totals view**
  - File: `supabase/migrations/YYYYMMDD_create_attendance_with_totals_view.sql`
  - Computes: drink_count, beer_count, total_spent_cents, total_tip_cents
  - Status: Pending

- [ ] **Create migration: drop old location tables**
  - File: `supabase/migrations/YYYYMMDD_drop_old_location_tables.sql`
  - Drops: user_locations, location_sharing_preferences
  - Status: Pending

- [ ] **Create migration: location_sessions**
  - File: `supabase/migrations/YYYYMMDD_create_location_sessions.sql`
  - Includes: session management, location_session_members, location_points
  - Status: Pending

- [ ] **Create migration: wrapped_cache_metadata**
  - File: `supabase/migrations/YYYYMMDD_create_wrapped_cache_metadata.sql`
  - Event-driven caching with invalidation tracking
  - Status: Pending

- [ ] **Remove profiles.custom_beer_cost**
  - Part of consumptions migration
  - Status: Pending

### 3.2 Data Migration

- [ ] **Migrate beer_count to consumptions**
  - [ ] Explode existing attendance.beer_count into consumption records
  - [ ] Use festival/tent pricing for base_price_cents
  - [ ] Verify totals match before/after
  - Status: Pending

- [ ] **Migrate location data**
  - [ ] Convert user_locations to location_sessions + location_points
  - [ ] Migrate preferences to location_session_members
  - Status: Pending

- [ ] **Update RLS policies**
  - [ ] Consumptions table policies
  - [ ] Location session policies
  - [ ] Location points policies
  - Status: Pending

### 3.3 Verification

- [ ] **Test migrations locally**
  - [ ] Run `pnpm sup:db:reset`
  - [ ] Verify all migrations apply cleanly
  - [ ] Check data integrity
  - Status: Pending

- [ ] **Generate updated database types**
  - [ ] Run `pnpm sup:db:types`
  - [ ] Verify types match new schema
  - Status: Pending

### Phase 3 Completion Checklist
- [ ] All migration files created
- [ ] Migrations tested locally
- [ ] Data integrity verified
- [ ] RLS policies updated
- [ ] Database types regenerated
- [ ] No data loss in migration

---

## Phase 4: Hono API Routes Implementation (Week 2-3)

**Goal**: Implement all API routes with OpenAPI specs

### Priority 1 - Essential Endpoints (Week 2)

- [ ] `POST /api/v1/consumption` - Log beer consumption
- [ ] `GET /api/v1/attendance` - List user's attendances
- [ ] `DELETE /api/v1/attendance/:id` - Remove attendance
- [ ] `GET /api/v1/festivals` - List festivals
- [ ] `GET /api/v1/festivals/:id` - Get festival details
- [ ] `GET /api/v1/tents` - List tents for festival

### Priority 2 - Group & Social (Week 3)

- [ ] `POST /api/v1/groups` - Create group
- [ ] `GET /api/v1/groups` - List user's groups
- [ ] `GET /api/v1/groups/:id` - Get group details
- [ ] `POST /api/v1/groups/:id/join` - Join group
- [ ] `POST /api/v1/groups/:id/leave` - Leave group
- [ ] `GET /api/v1/groups/:id/leaderboard` - Group rankings
- [ ] `GET /api/v1/leaderboard` - Global rankings

### Priority 3 - Advanced Features (Week 3)

- [ ] `GET /api/v1/achievements` - User's achievements
- [ ] `POST /api/v1/achievements/evaluate` - Trigger evaluation
- [ ] `GET /api/v1/wrapped/:festivalId` - Get wrapped data
- [ ] `POST /api/v1/wrapped/:festivalId/generate` - Generate wrapped
- [ ] `POST /api/v1/reservations` - Create reservation
- [ ] `POST /api/v1/reservations/:id/checkin` - Check in
- [ ] `POST /api/v1/location/sessions` - Start location sharing
- [ ] `DELETE /api/v1/location/sessions/:id` - Stop sharing
- [ ] `GET /api/v1/location/nearby` - Nearby members
- [ ] `POST /api/v1/notifications/token` - Register FCM token
- [ ] `GET /api/v1/photos/upload-url` - Get signed URL

### Service Layer

- [ ] ConsumptionService - Beer logging with achievements
- [ ] AchievementService - Automatic evaluation
- [ ] NotificationService - Rate-limited notifications
- [ ] LocationService - Session management
- [ ] WrappedService - Statistics computation

### Repository Layer

- [ ] IAttendanceRepository interface + Supabase impl
- [ ] IConsumptionRepository interface + Supabase impl
- [ ] IFestivalRepository interface + Supabase impl
- [ ] IGroupRepository interface + Supabase impl
- [ ] IAchievementRepository interface + Supabase impl
- [ ] ILocationRepository interface + Supabase impl

### Phase 4 Completion Checklist
- [ ] All Priority 1 endpoints working
- [ ] All Priority 2 endpoints working
- [ ] All Priority 3 endpoints working
- [ ] Service layer implements business logic
- [ ] Repository layer provides data access
- [ ] OpenAPI spec generated successfully
- [ ] All routes validated with Zod

---

## Phase 5: Web App Migration to API Client (Week 3-4)

**Goal**: Migrate web app from server actions to API client

### 5.1 Generate TypeScript Client

- [ ] **Set up client generation**
  - [ ] Script: `packages/api/scripts/generate-openapi.ts`
  - [ ] Script: `packages/api-client/scripts/generate-client.ts`
  - Status: Pending

- [ ] **Create client factory**
  - [ ] `packages/api-client/src/client.ts`
  - [ ] Auth header injection
  - [ ] Base URL configuration
  - Status: Pending

- [ ] **Test client generation in CI**
  - [ ] Add to GitHub Actions
  - Status: Pending

### 5.2 Update React Query Hooks

- [ ] `hooks/useAttendance.ts` - Switch to API client
- [ ] `hooks/useGroups.ts` - Switch to API client
- [ ] `hooks/useAchievements.ts` - Switch to API client
- [ ] `hooks/useLeaderboard.ts` - Switch to API client
- [ ] `hooks/useWrapped.ts` - Switch to API client
- [ ] `hooks/useLocationSharing.ts` - Switch to API client
- [ ] `hooks/useProfile.ts` - Switch to API client
- [ ] `hooks/useActivityFeed.ts` - Switch to API client
- [ ] `hooks/useTents.ts` - Switch to API client
- [ ] `hooks/useFestival.ts` - Switch to API client

### 5.3 Integrate Hono into Next.js

- [ ] **Create catch-all API route**
  - File: `apps/web/app/api/[[...route]]/route.ts`
  - Mount Hono app with `handle()` from `hono/vercel`
  - Status: Pending

- [ ] **Configure runtime**
  - [ ] Test with `edge` runtime
  - [ ] Fallback to `nodejs` if needed
  - Status: Pending

### 5.4 Remove Server Actions

- [ ] Delete `app/(private)/home/actions.ts`
- [ ] Delete `app/(private)/attendance/actions.ts`
- [ ] Delete `app/(private)/groups/actions.ts`
- [ ] Delete `app/(private)/profile/actions.ts`
- [ ] Delete `app/(private)/calendar/actions.ts`
- [ ] Delete `app/(private)/leaderboard/actions.ts`
- [ ] Delete `app/(private)/admin/actions.ts`
- [ ] Delete `lib/actions/achievements.ts`
- [ ] Delete `lib/actions/activity-feed.ts`
- [ ] Delete `lib/actions/notifications.ts`
- [ ] Delete `lib/actions/wrapped.ts`

### Phase 5 Completion Checklist
- [ ] TypeScript client generates successfully
- [ ] All hooks migrated to API client
- [ ] Hono mounted in Next.js
- [ ] Server actions removed
- [ ] Web app builds without errors
- [ ] All features still functional
- [ ] No type errors

---

## Phase 6-12: Remaining Phases

_(Detailed tracking to be added as we progress)_

**Phase 6**: Expo Mobile App Foundation (Week 5-6)
**Phase 7**: Core Mobile Features (Week 6-8)
**Phase 8**: Advanced Features (Week 9-11)
**Phase 9**: Native Enhancements (Week 12-14)
**Phase 10**: Internationalization (Week 14)
**Phase 11**: Testing & Quality (Week 15)
**Phase 12**: Polish & Launch (Week 16)

---

## Blockers & Issues

_No blockers currently_

---

## Notes & Decisions

### 2025-12-29
- Started implementation
- Created progress tracking file
- Plan approved: Full migration approach (Hono + Turborepo)
- Timeline: 16 weeks
- Breaking changes acceptable for web app

---

## Quick Stats

- **Total Tasks**: TBD
- **Completed**: 0
- **In Progress**: 0
- **Pending**: All
- **Blocked**: 0
- **Failed**: 0

---

**Last Updated**: 2025-12-29
**Next Milestone**: Phase 1 completion (monorepo setup)
