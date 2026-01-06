# CLAUDE PROJECT ANALYSIS - ProstCounter (Precursor Project)

**CONTEXT**: This Next.js web app is the PRECURSOR to a new T4 stack (Tamagui + tRPC + TypeScript + Turborepo) project. The new project will be MULTI-FESTIVAL (not just Oktoberfest) and include NATIVE mobile versions. Use this analysis as implementation guide and feature reference.

## TECH_STACK_CURRENT

- Next.js 15.4.6 + React 19.1.1 + TypeScript 5.9.2
- Supabase (auth + db + storage)
- Tailwind 4.1.11 + Radix UI + shadcn/ui
- PWA: next-pwa with caching
- Monitoring: Sentry
- Package: pnpm

## FEATURES_CORE

### AUTH_SYSTEM

- Supabase Auth UI
- User profiles: username, full_name, avatar_url
- Admin panel: user/group management

### ATTENDANCE_TRACKING

- Daily beer_count logging per date
- tent_visits with timestamps
- beer_pictures linked to attendances
- Quick registration from home
- Detailed forms with date picker

### GROUP_COMPETITION

- Create/join via invite_token
- 3 winning_criteria: days_attended | total_beers | avg_beers
- Group settings + member management
- Group galleries: photos by date/user

### LEADERBOARDS

- Global leaderboard
- Personal stats
- Group rankings
- Highlights dashboard

### SOCIAL_FEATURES

- Photo sharing in galleries
- Share app functionality
- Beer cost tracking (€16.2 constant)

## DATABASE_SCHEMA_SUPABASE

```typescript
attendances: {
  id: string;
  user_id: string;
  date: string;
  beer_count: number;
  created_at: string;
  updated_at: string;
}

tent_visits: {
  // Links to attendances, tracks locations
}

beer_pictures: {
  attendance_id: string;
  user_id: string;
  picture_url: string;
  created_at: string;
}

groups: {
  name: string;
  invite_token: string;
  winning_criteria: WinningCriteria;
}

group_members: {
  // user-group relationships
}

profiles: {
  username: string;
  full_name: string;
  avatar_url: string;
}
```

## UI_DESIGN_SYSTEM

### COLORS_BRAND

- Primary: yellow-400, yellow-500, yellow-600
- Button variants: yellow | yellowOutline | darkYellow
- Focus: yellow ring states
- Brand text: dual yellow gradient (yellow-600 + yellow-500)

### COMPONENTS_PATTERNS

- shadcn/ui complete library
- Custom CSS: .button, .card, .input with yellow theme
- App name: "ProstCounter" + 🍻 emoji
- Mobile-first responsive with max-width containers

## FILE_STRUCTURE_PATTERNS

```
app/(private)/ - auth routes: home, attendance, groups, leaderboard, profile
app/(public)/ - auth pages
components/ui/ - shadcn components
components/[Feature]/ - feature components
utils/supabase/ - client setup
```

## CONSTANTS_FESTIVAL_SPECIFIC

```typescript
BEGINNING_OF_WIESN = "2024-09-21";
END_OF_WIESN = "2024-10-06";
COST_PER_BEER = 16.2;
WIESN_MAP_URL = "https://wiesnmap.muenchen.de/";
TIMEZONE = "Europe/Berlin";
```

## T4_MIGRATION_REQUIREMENTS

### MULTI_FESTIVAL_CHANGES

- Add festival_id to all core tables
- Festival management system
- Dynamic date ranges, costs, URLs per festival
- Festival selector UI

### NATIVE_IMPLEMENTATION_TODO

- shadcn/ui → Tamagui components conversion
- Next.js routing → React Navigation
- Add tRPC for type-safe APIs
- Mobile camera integration for photos
- PWA → Native app features (push notifications, offline)
- Turborepo monorepo structure

### REUSABLE_PATTERNS

- Form validation: Formik + Yup
- Data tables: @tanstack/react-table
- Toast notifications system
- Error boundaries
- Node-cache + Supabase optimizations

## WINNING_CRITERIA_ENUM

```typescript
enum WinningCriteria {
  days_attended = "days_attended", // "Most Days Attended"
  total_beers = "total_beers", // "Most Beers Drank"
  avg_beers = "avg_beers", // "Best Average Beers per Day"
}
```

## PWA_CONFIG_REFERENCE

- Service worker with NetworkFirst + CacheFirst strategies
- Image caching (30 days), static resources (7 days)
- Google Fonts caching (1 year)
- API caching (5 minutes)

---

**MIGRATION_GOAL**: Transform this single-festival web app into multi-festival T4 stack with web + native support
