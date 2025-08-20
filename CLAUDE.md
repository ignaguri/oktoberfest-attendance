# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProstCounter is a Next.js PWA for tracking Oktoberfest attendance. Users log daily beer consumption, participate in group competitions, and view leaderboards. **Current focus**: Expand from single-year to **multi-festival support** (2024 + 2025 Oktoberfest) and add **gamification features** with achievements system.

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
- **PWA**: next-pwa with service worker caching
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

### Key Business Logic
- **Festival Dates**: Currently hardcoded Sept 21 - Oct 6, 2024 in `lib/constants.ts`
- **Beer Cost**: €16.2 per beer (COST_PER_BEER constant)
- **Competition Types**: days_attended | total_beers | avg_beers
- **Timezone**: Europe/Berlin for date calculations

## Multi-Festival Migration Requirements

### Database Schema Changes Needed
1. **Add `festivals` table**: id, name, start_date, end_date, beer_cost, location, map_url
2. **Add `festival_id` foreign key to**:
   - attendances (link attendance to specific festival)
   - groups (competitions per festival)
   - tent_visits (tents vary by festival year)
3. **Update business logic** to be festival-aware instead of hardcoded dates

### Festival Data Structure
```typescript
interface Festival {
  id: string;
  name: string;           // "Oktoberfest 2024", "Oktoberfest 2025"
  start_date: string;     // "2024-09-21", "2025-09-20"
  end_date: string;       // "2024-10-06", "2025-10-05" 
  beer_cost: number;      // €16.2 (may vary by year)
  location: string;       // "Munich, Germany"
  map_url: string;        // wiesnmap URL
  is_active: boolean;     // Current festival
  status: 'upcoming' | 'active' | 'ended';
}
```

### UI/UX Changes Required
- **Festival selector** on home dashboard
- **Historical data view** for past festivals (2024)
- **Festival-specific leaderboards** and group competitions
- **Festival switching** in navigation/settings
- Update constants.ts to be dynamic per selected festival

## Gamification System Requirements

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
  name: string;           // "Early Bird"
  description: string;    // "Attended first day of festival"
  category: AchievementCategory;
  icon: string;          // Emoji or icon identifier
  points: number;        // Gamification points awarded
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  conditions: AchievementConditions;
}

interface UserAchievement {
  user_id: string;
  achievement_id: string;
  festival_id: string;   // Festival-specific achievements
  unlocked_at: string;
  progress?: number;     // For progressive achievements
}
```

### Gamification Features to Add
- **Points system** based on achievements + attendance
- **Progress bars** for trackable achievements
- **Achievement notifications** when unlocked
- **Profile badges** displaying earned achievements
- **Leaderboard integration** with achievement points
- **Achievement gallery** showing locked/unlocked status

## Important Patterns

### Authentication Flow
- Supabase Auth UI for sign-up/sign-in
- Row Level Security (RLS) policies enforce data access
- Private layout redirects unauthenticated users to `/sign-in`

### Form Validation
- **Current**: Uses Formik + Yup schema validation
- **Migration Goal**: Replace with react-hook-form + Zod for better TypeScript integration and performance
- Real-time client-side validation with server-side RLS backup

### Image Handling
- Upload to Supabase storage in `beer_pictures` bucket
- Multiple photos per attendance record
- Optimized caching (30 days) via next-pwa

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

1. **Multi-Festival Infrastructure**: Update database schema and core business logic
2. **Festival Management**: Admin panel for creating/managing festivals
3. **Achievement System**: Design and implement gamification features
4. **Historical Data**: Ensure 2024 data is preserved and accessible
5. **Festival Switching**: UI for users to navigate between festivals
6. **Form System Migration**: Replace Formik + Yup with react-hook-form + Zod for better TypeScript integration

Use `@CLAUDE_FEATURES_FLOWS.md` and `@CLAUDE_PROJECT_ANALYSIS.md` for detailed feature specifications when implementing multi-festival and gamification features.
- update the memory with latest changes