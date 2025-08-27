# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProstCounter is a Next.js PWA for tracking Oktoberfest attendance. Users log daily beer consumption, participate in group competitions, and view leaderboards. **✅ Multi-festival support** is now fully implemented (2024 + 2025 Oktoberfest). **Current focus**: Implement **gamification features** with achievements system.

## Development Commands

### Core Development

- `pnpm dev` - Start development server at localhost:3000
- `pnpm build` - Production build
- `pnpm start` - Start production server
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Run ESLint

### Supabase Database Commands

- `pnpm sup:start` - Start local Supabase (requires Docker)
- `pnpm sup:stop` - Stop local Supabase
- `pnpm sup:restart` - Restart Supabase services
- `pnpm sup:db:reset` - Reset DB and run migrations
- `pnpm sup:db:pull` - Pull remote DB changes
- `pnpm sup:db:push` - Push local migrations to remote
- `pnpm sup:db:types` - Generate TypeScript types from DB schema
- `pnpm sup:mig:new` - Create new migration file

### Test Users (Local Development)

Seed data creates users `user1@example.com` through `user10@example.com` with password `password`.

## Architecture

### Tech Stack

- **Frontend**: Next.js 15.4.6, React 19.1.1, TypeScript 5.9.2
- **Backend**: Supabase (auth, database, storage)
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **PWA**: serwist with service worker caching
- **Push Notifications**: Novu + Firebase FCM integration
- **Monitoring**: Sentry error tracking
- **Package Manager**: pnpm

### Application Structure

```
app/
├── (private)/          # Auth-protected routes
│   ├── home/           # Dashboard with quick registration
│   ├── attendance/     # Detailed attendance management
│   ├── groups/         # Group creation/management
│   ├── leaderboard/    # Global rankings
│   ├── profile/        # User settings
│   └── admin/          # Super admin panel
├── (public)/           # Public auth pages
└── api/                # API routes
```

### Core Data Models

- **attendances**: Daily beer count per user/date
- **tent_visits**: Location tracking with timestamps
- **beer_pictures**: Photo uploads linked to attendances
- **groups**: Competition groups with invite tokens
- **group_members**: User-group relationships
- **profiles**: User metadata (username, full_name, avatar)
- **user_notification_preferences**: Push notification settings per user

### Key Business Logic

- **Festival Dates**: ✅ **DYNAMIC** - Read from database via FestivalContext
- **Beer Cost**: ✅ **DYNAMIC** - Configurable per festival with fallback to €16.2
- **Competition Types**: days_attended | total_beers | avg_beers
- **Timezone**: ✅ **DYNAMIC** - Configurable per festival with fallback to Europe/Berlin

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

### State Management

- No external state library - uses React state + Server Components
- Node-cache for performance optimizations
- Real-time data via Supabase subscriptions where needed

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

## Next Steps / Future Enhancements

### UI/UX Improvements

1. **✅📸 Photo Gallery Integration**: COMPLETED - Same preview functionality added to pics from gallery in the attendance table
2. **✅ Empty state for Photo gallery**: COMPLETED - Empty state for photo gallery implemented
3. **✅👤 Profile Quick Preview**: COMPLETED - Quick preview of someone else's profile from group interface

### Technical Improvements

1. **⚠️ Server Error Handling** - Properly handle server errors using Next.js error handling patterns
   - Reference: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-expected-errors-from-server-actions
