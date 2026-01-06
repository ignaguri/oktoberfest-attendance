# ProstCounter - Complete Project Analysis for Expo Migration

## Executive Summary

**ProstCounter** is a sophisticated Progressive Web App (PWA) built with Next.js 16 that enables users to track beer festival attendance, compete with friends in groups, earn achievements, and share their festival experiences. This document provides a comprehensive analysis of the application architecture, database schema, features, and implementation patterns to facilitate the creation of a native mobile app using Expo (React Native).

### Key Metrics

- **Version**: 0.7.0
- **Tech Stack**: Next.js 16.1.1, React 19.2.3, TypeScript 5.9.3
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack React Query v5 (provider-agnostic abstraction)
- **UI Framework**: Tailwind CSS, shadcn/ui, Radix UI
- **Push Notifications**: Novu + Firebase FCM
- **PWA**: Serwist service worker
- **Package Manager**: pnpm 10.14.0

---

## 1. Database Schema Analysis

### Core Tables

#### **festivals**

Multi-festival support with dynamic configuration

```typescript
{
  id: string(uuid);
  name: string; // "Oktoberfest 2024", "Oktoberfest 2025"
  short_name: string; // Short display name
  start_date: string(date);
  end_date: string(date);
  beer_cost: number | null; // Default €16.2, configurable per festival
  location: string; // "Munich, Germany"
  map_url: string | null; // URL to festival map
  is_active: boolean;
  status: "upcoming" | "active" | "ended";
  festival_type: "oktoberfest" | "starkbierfest" | "fruehlingsfest" | "other";
  timezone: string; // Default: "Europe/Berlin"
  description: string | null;
  created_at: timestamp;
  updated_at: timestamp;
}
```

#### **profiles**

User profile data (linked to Supabase auth.users)

```typescript
{
  id: string (uuid, FK to auth.users)
  username: string | null
  full_name: string | null
  avatar_url: string | null
  website: string | null
  custom_beer_cost: number | null // Override festival default
  is_super_admin: boolean | null
  tutorial_completed: boolean | null
  tutorial_completed_at: timestamp | null
  updated_at: timestamp | null
}
```

#### **attendances**

Daily beer consumption tracking (festival-scoped)

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  festival_id: string (FK to festivals)
  date: string (date)
  beer_count: number (default: 0)
  created_at: timestamp
  updated_at: timestamp
}
```

#### **tent_visits**

Location tracking within festivals

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  tent_id: string (FK to tents)
  festival_id: string (FK to festivals)
  visit_date: timestamp | null
}
```

#### **tents**

Beer tent master data

```typescript
{
  id: string(uuid);
  name: string;
  category: string | null;
}
```

#### **festival_tents**

Association table for tents available at specific festivals

```typescript
{
  id: string (uuid)
  festival_id: string (FK to festivals)
  tent_id: string (FK to tents)
  beer_price: number | null  // Per-tent pricing override
  created_at: timestamp
  updated_at: timestamp
}
```

#### **groups**

Competition groups (festival-scoped)

```typescript
{
  id: string (uuid)
  name: string
  description: string | null
  password: string (hashed)
  festival_id: string (FK to festivals)
  winning_criteria_id: number (FK to winning_criteria)
  created_by: string (FK to profiles)
  invite_token: string | null (unique, shareable)
  token_expiration: timestamp | null
  created_at: timestamp
}
```

#### **group_members**

User-group relationships

```typescript
{
  id: string (uuid)
  group_id: string (FK to groups)
  user_id: string (FK to profiles)
  joined_at: timestamp
}
```

#### **winning_criteria**

Group competition types

```typescript
{
  id: number(serial);
  name: "days_attended" | "total_beers" | "avg_beers";
}
```

#### **beer_pictures**

Photo uploads linked to attendance records

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  attendance_id: string (FK to attendances)
  picture_url: string (Supabase Storage URL)
  visibility: 'public' | 'private'
  created_at: timestamp
}
```

### Gamification Tables

#### **achievements**

Achievement definitions

```typescript
{
  id: string (uuid)
  name: string
  description: string
  category: 'consumption' | 'attendance' | 'explorer' | 'social' | 'competitive' | 'special'
  icon: string (emoji or icon identifier)
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  conditions: JSON (achievement unlock conditions)
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

#### **user_achievements**

User achievement progress

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  achievement_id: string (FK to achievements)
  festival_id: string (FK to festivals)
  unlocked_at: timestamp
  progress: JSON | null (current progress toward achievement)
}
```

#### **achievement_events**

Achievement unlock events for notifications

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  achievement_id: string (FK to achievements)
  festival_id: string (FK to festivals)
  rarity: achievement_rarity_enum
  user_notified_at: timestamp | null
  group_notified_at: timestamp | null
  created_at: timestamp
}
```

### Social Features Tables

#### **user_notification_preferences**

Push notification settings

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  push_enabled: boolean | null
  reminders_enabled: boolean | null
  group_notifications_enabled: boolean | null
  achievement_notifications_enabled: boolean | null
  group_join_enabled: boolean | null
  checkin_enabled: boolean | null
  created_at: timestamp
  updated_at: timestamp
}
```

#### **notification_rate_limit**

Rate limiting for spam prevention

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  group_id: string | null (FK to groups)
  notification_type: string
  created_at: timestamp
}
```

#### **user_photo_global_settings**

Global photo privacy settings

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  hide_photos_from_all_groups: boolean (default: false)
  created_at: timestamp
  updated_at: timestamp
}
```

#### **user_group_photo_settings**

Per-group photo privacy settings

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  group_id: string (FK to groups)
  hide_photos_from_group: boolean (default: false)
  created_at: timestamp
  updated_at: timestamp
}
```

### Location Sharing Tables

#### **user_locations**

Real-time location sharing

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  festival_id: string (FK to festivals)
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  status: 'active' | 'paused' | 'expired'
  last_updated: timestamp
  expires_at: timestamp (auto-cleanup after expiration)
  created_at: timestamp
  updated_at: timestamp
}
```

#### **location_sharing_preferences**

Per-group location sharing settings

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  group_id: string (FK to groups)
  festival_id: string (FK to festivals)
  sharing_enabled: boolean (default: false)
  notification_enabled: boolean (default: true)
  auto_enable_on_checkin: boolean (default: false)
  created_at: timestamp
  updated_at: timestamp
}
```

### Reservation & Wrapped Tables

#### **reservations**

Tent reservation system with reminders

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  festival_id: string (FK to festivals)
  tent_id: string (FK to tents)
  start_at: timestamp
  end_at: timestamp | null
  status: string (default: 'pending')
  note: string | null
  reminder_offset_minutes: number (default: 30)
  reminder_sent_at: timestamp | null
  prompt_sent_at: timestamp | null
  processed_at: timestamp | null
  auto_checkin: boolean (default: false)
  visible_to_groups: boolean (default: true)
  created_at: timestamp
  updated_at: timestamp
}
```

#### **wrapped_data_cache**

Cached "Wrapped" (year-in-review) statistics

```typescript
{
  id: string (uuid)
  user_id: string (FK to profiles)
  festival_id: string (FK to festivals)
  wrapped_data: JSON (complete wrapped statistics)
  generated_by: string (default: 'user')
  created_at: timestamp
  updated_at: timestamp
}
```

### Views

#### **leaderboard** (materialized view)

Pre-aggregated leaderboard data for performance

```typescript
{
  user_id: string;
  festival_id: string;
  festival_name: string;
  username: string;
  full_name: string;
  avatar_url: string;
  group_id: string;
  group_name: string;
  total_beers: number;
  days_attended: number;
  avg_beers: number(decimal);
}
```

#### **activity_feed** (view)

News feed of recent group member activities

```typescript
{
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  festival_id: string;
  activity_type: "beer_count_update" |
    "tent_checkin" |
    "photo_upload" |
    "group_join" |
    "achievement_unlock";
  activity_data: JSON;
  activity_time: timestamp;
}
```

#### **v_user_shared_group_members** (view)

Privacy view for shared group membership

```typescript
{
  viewer_id: string;
  owner_id: string;
  festival_id: string;
}
```

### Key Database Functions (RPC)

1. **`add_or_update_attendance_with_tents_v3`** - Atomic attendance + tent visit update
2. **`get_user_festival_stats_with_positions`** - User stats with group rankings
3. **`get_global_leaderboard`** - Festival-scoped global rankings
4. **`get_group_leaderboard`** - Group-specific rankings
5. **`join_group`** - Festival-aware group joining with validation
6. **`get_user_achievements`** - Achievement data with progress tracking
7. **`evaluate_user_achievements`** - Automatic achievement evaluation
8. **`get_wrapped_data_cached`** - Cached wrapped statistics with fallback
9. **`get_nearby_group_members`** - Geospatial query for location sharing
10. **`check_notification_rate_limit`** - Rate limiting checks
11. **`record_notification_rate_limit`** - Rate limit recording

---

## 2. Application Architecture

### Tech Stack

#### Frontend

- **Framework**: Next.js 16.1.1 (App Router, React Server Components)
- **React**: 19.2.3 (latest with server actions)
- **TypeScript**: 5.9.3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 4.1.18
- **Animations**: Framer Motion 12.23.26
- **State Management**: TanStack React Query v5 (provider-agnostic abstraction)

#### Backend

- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Auth**: Supabase Auth (JWT-based, Row Level Security)
- **Storage**: Supabase Storage (beer_pictures bucket)
- **Push Notifications**: Novu + Firebase FCM
- **Cron Jobs**: Vercel Cron (reservations, achievements)

#### PWA Features

- **Service Worker**: Serwist 9.4.2
- **Offline Support**: Cache-first strategy
- **Install Prompt**: Custom install UI
- **Notifications**: Web Push API + FCM

#### Developer Tools

- **Testing**: Vitest + Playwright (E2E)
- **Linting**: ESLint 9 + Prettier
- **Type Safety**: Strict TypeScript + Zod validation
- **Error Tracking**: Sentry
- **Analytics**: Google Analytics, Vercel Speed Insights

### App Structure

```
app/
├── (private)/              # Auth-protected routes
│   ├── home/               # Dashboard with quick attendance
│   ├── calendar/           # Calendar view + attendance modal
│   ├── attendance/         # Detailed attendance management
│   ├── groups/             # Group list and management
│   │   └── [id]/           # Group detail pages
│   │       ├── page.tsx              # Group overview
│   │       ├── gallery/page.tsx      # Photo gallery
│   │       ├── calendar/page.tsx     # Group calendar
│   │       └── location/page.tsx     # Live location map
│   ├── join-group/         # Group joining flow
│   ├── group-settings/     # Group settings management
│   ├── leaderboard/        # Global rankings
│   ├── achievements/       # Achievement gallery
│   ├── profile/            # User profile settings
│   ├── wrapped/            # Year-in-review feature
│   └── admin/              # Super admin panel
│
├── (public)/               # Public routes
│   ├── sign-in/
│   ├── sign-up/
│   ├── reset-password/
│   ├── unauthorized/
│   ├── offline/
│   ├── privacy/
│   └── r/[slug]/           # Public reservation links
│
├── api/                    # API routes
│   ├── version/            # App version endpoint
│   ├── novu/               # Novu webhook handler
│   ├── image/[id]/         # Image proxy/optimization
│   ├── location-sharing/   # Location API endpoints
│   └── cron/scheduler/     # Cron job handlers
│
└── layout.tsx              # Root layout with providers
```

### Context Providers

#### **FestivalContext**

Global festival state management

- Manages current selected festival
- Auto-selects festival based on:
  1. localStorage preference
  2. Current date (within festival dates)
  3. `is_active` flag
  4. Most recent festival
- Provides festival list and switching capability

#### **NotificationContext**

Push notification management

- Manages FCM token registration
- Handles notification permissions
- Syncs user with Novu
- Manages notification preferences
- Coordinates WhatsNew and InstallPWA modals

#### **TutorialContext**

First-time user onboarding

- Tutorial overlay system
- Step-by-step guided tour
- Completion tracking in database

#### **DataProvider (TanStack React Query)**

Provider-agnostic data layer

- Query client setup with sensible defaults
- React Query DevTools in development
- Automatic retry and refetching logic
- Centralized cache management

---

## 3. Core Features & Business Logic

### 3.1 Festival Management

**Multi-Festival Architecture**:

- All data is festival-scoped (attendances, groups, achievements)
- Dynamic configuration (dates, beer cost, timezone, map URL)
- Festival switching persists in localStorage
- Auto-selection based on current date

**Festival Types**:

- Oktoberfest (primary use case)
- Starkbierfest
- Fruehlingsfest
- Other (custom festivals)

### 3.2 Attendance Tracking

**Quick Attendance** (Home page):

- Select single tent
- Record beer count
- Defaults to current date
- Immediate submission

**Detailed Attendance** (Calendar page):

- Multiple tent selection
- Custom date picker (within festival dates)
- Beer count with validation
- Tent visit tracking
- Photo uploads (multiple per attendance)

**Business Rules**:

- Beer count can be 0 (tent visit only)
- Dates must be within festival range
- One attendance record per user per date
- Updates replace existing records
- Tent visits are additive (no duplicates)

**Cost Calculation**:

```typescript
cost = beer_count × (user.custom_beer_cost || festival.beer_cost || 16.2)
```

### 3.3 Group Competitions

**Group Types** (winning_criteria):

1. **Most Days Attended** - Longest attendance streak
2. **Most Beers Drank** - Highest total beer count
3. **Best Average** - Highest beers per day attended

**Group Features**:

- Password-protected
- Shareable invite tokens (QR code + deep link)
- Festival-scoped (groups exist per festival)
- Dynamic leaderboards with real-time rankings
- Group galleries (member photos by date)
- Group calendars (member attendance grid)
- Leave/rejoin capability

**Group Notifications**:

- New member joins
- Tent check-ins (nearby members)
- Achievement unlocks (group chat style)
- Location sharing started

### 3.4 Achievement System

**Achievement Categories**:

1. **Consumption**: "10 beers total", "50+ beers"
2. **Attendance**: "3 days in a row", "Perfect attendance"
3. **Explorer**: "5+ different tents", "All tent categories"
4. **Social**: "First group joined", "Group winner"
5. **Competitive**: "Top 3 in group", "Global leaderboard"
6. **Special**: "Early bird (first day)", "Photo master"

**Achievement Mechanics**:

- Evaluated automatically after attendance updates
- Progress tracking in JSON field
- Rarity levels: common, rare, epic, legendary
- Points awarded on unlock
- Festival-scoped (can re-earn in new festivals)
- Group notifications for rare+ achievements

**Achievement Conditions** (JSON format):

```json
{
  "type": "beer_count",
  "target": 50,
  "operator": ">=",
  "scope": "festival"
}
```

**Auto-Evaluation Triggers**:

- After attendance submission
- After tent check-in
- After photo upload
- Scheduled cron job (hourly)

### 3.5 Location Sharing

**Real-Time Features**:

- Live location updates (polling every 30s)
- Geospatial queries for nearby members
- Auto-expiration (2 hour default)
- Per-group privacy controls
- Map visualization with clustering

**Privacy Settings**:

- Global toggle (share with all groups)
- Per-group overrides
- Notification preferences
- Auto-enable on tent check-in

**Notifications**:

- Rate-limited (max 1 per 5 minutes per group)
- "User started sharing location"
- Silent stop notifications

### 3.6 Photo Management

**Features**:

- Multiple photos per attendance
- Supabase Storage integration
- Image optimization (Sharp)
- Privacy controls (public/private)
- Group gallery views
- Photo preview with lightbox

**Privacy Layers**:

1. **Photo Visibility**: public/private per photo
2. **Global Setting**: Hide from all groups
3. **Per-Group Setting**: Hide from specific group

**Gallery Views**:

- Personal gallery (calendar page)
- Group gallery (grouped by date + user)
- Wrapped slideshow (year highlights)

### 3.7 Wrapped Feature

**"Year in Review" Statistics**:

- Total beers consumed
- Days attended
- Favorite tent
- Most expensive day
- Total money spent
- Beer personality (based on patterns)
- Peak moment (highest single day)
- Tent explorer status
- Group rankings
- Achievement highlights
- Photo memories

**Caching Strategy**:

- Pre-computed and cached in database
- Generated on first access
- Invalidated on new attendance
- Admin can regenerate for all users

**Sharing**:

- Social media share cards
- Screenshot download (html-to-image)
- Deep links to individual slides

### 3.8 Reservation System

**Features**:

- Schedule tent reservations
- Reminder notifications (configurable offset)
- Check-in prompts at reservation time
- Auto-check-in option
- Group visibility toggle

**Notification Flow**:

1. **Reminder**: Sent X minutes before reservation
2. **Prompt**: Sent at reservation start time
3. **Auto-Check-In**: Automatically creates tent visit

**Cron Jobs** (Vercel Cron):

- `/api/cron/scheduler/reservations` - Every 5 minutes
- `/api/cron/scheduler/achievements` - Hourly evaluation

---

## 4. Authentication & Authorization

### Supabase Auth Flow

**Sign Up**:

```typescript
// Email + password registration
supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${origin}/auth/callback`,
  },
});
// Auto-creates profile row via database trigger
```

**Sign In**:

```typescript
// Email + password
supabase.auth.signInWithPassword({ email, password });

// Magic link
supabase.auth.signInWithOtp({ email });
```

**Session Management**:

- Server-side: Cookie-based sessions via `@supabase/ssr`
- Client-side: Automatic token refresh
- Middleware: Auth check on protected routes

### Row Level Security (RLS)

**Key Policies**:

- **attendances**: Users can only CRUD their own records
- **profiles**: Users can read all, but only update their own
- **groups**: Members can read, creators can update
- **group_members**: Auto-join policy on group creation
- **beer_pictures**: Visibility-based read policy
- **user_achievements**: Users can read their own + shared group members'

**Super Admin Bypass**:

```sql
CREATE POLICY "Super admin can do everything"
ON table_name
TO authenticated
USING (is_super_admin());
```

### Server vs Client Supabase Clients

**Server Client** (`utils/supabase/server.ts`):

```typescript
// Regular client (respects RLS, uses user session)
const supabase = await createClient();

// Service role client (bypasses RLS, admin only)
const supabase = await createClient(true);
```

**Browser Client** (`utils/supabase/client.ts`):

```typescript
const supabase = createSupabaseBrowserClient();
// Always respects RLS
```

---

## 5. Data Management & State

### Provider-Agnostic Architecture

**Abstraction Layer** (`lib/data/types.ts`):

```typescript
interface DataProvider {
  useQuery<T>(key, fn, options): DataQueryResult<T>;
  useMutation<TData, TVariables>(
    fn,
    options,
  ): DataMutationResult<TData, TVariables>;
  invalidateQueries(key?);
  setQueryData<T>(key, data);
  getQueryData<T>(key);
}
```

**Current Implementation**: TanStack React Query v5
**Future Options**: react-shared-states, SWR, Redux Toolkit Query

### Query Keys Factory

Centralized cache key generation (`lib/data/types.ts`):

```typescript
QueryKeys.festivals(); // ["festivals"]
QueryKeys.festival(id); // ["festival", id]
QueryKeys.userGroups(userId, festivalId); // ["user", userId, "groups", festivalId]
QueryKeys.globalLeaderboard(criteria, fId); // ["leaderboard", "global", criteria, fId]
```

### Business Logic Hooks

**Pattern**:

```typescript
// hooks/useGroups.ts
export function useUserGroups(festivalId?: string) {
  return useQuery(
    QueryKeys.userGroups("current", festivalId || ""),
    () => fetchUserGroups(festivalId!),
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

export function useCreateGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation((data) => createGroup(data), {
    onSuccess: (data, variables) => {
      // Invalidate related queries
      invalidateQueries(["user", "current", "groups"]);
      invalidateQueries(["groups", variables.festivalId]);
    },
  });
}
```

**Available Hooks**:

- `useGroups.ts`: Group CRUD operations
- `useFestival.ts`: Festival data fetching
- `useAttendance.ts`: Attendance management
- `useAchievements.ts`: Achievement data
- `useLeaderboard.ts`: Ranking data
- `useProfile.ts`: User profile management
- `useActivityFeed.ts`: News feed data
- `useLocationSharing.ts`: Location sharing operations
- `useWrapped.ts`: Wrapped data fetching

### Caching Strategy

**Stale Times** (by data volatility):

- **Static data** (festivals, tents): 1-2 hours
- **User settings** (profile, preferences): 5-10 minutes
- **Dynamic data** (attendances, leaderboard): 1-5 minutes
- **Real-time data** (locations, activity feed): 30 seconds

**Invalidation Patterns**:

1. **Prefix-based**: Invalidate all queries starting with key
   ```typescript
   invalidateQueries(["user"]); // Invalidates all user-related queries
   ```
2. **Optimistic updates**: Update cache before server confirmation
3. **Manual invalidation**: After mutations (creates, updates, deletes)

### Server Actions

**Pattern**:

```typescript
"use server";

export async function createGroup(data: CreateGroupFormData) {
  const user = await getUser(); // Auth check
  const supabase = await createClient();

  // Validation
  const validated = createGroupSchema.parse(data);

  // Business logic
  const { data: group, error } = await supabase
    .from("groups")
    .insert({ ...validated, created_by: user.id })
    .select()
    .single();

  if (error) throw error;

  // Revalidate cache tags
  revalidateTag("groups");

  return group;
}
```

**Benefits**:

- Type-safe server functions
- Direct database access (no API layer needed)
- Automatic error handling
- Progressive enhancement (works without JS)

---

## 6. Push Notifications Architecture

### Novu Integration

**Workflow**:

1. User registers/signs in → Sync with Novu subscriber
2. User grants notification permission → Get FCM token
3. Register FCM token with Novu
4. Server triggers Novu workflow → Novu sends via FCM

**Novu Workflows** (`workflows/`):

- `group-join-notification` - New member joins group
- `tent-checkin-notification` - Friend checks into tent
- `achievement-unlock-notification` - User unlocks achievement
- `location-sharing-notification` - User shares location
- `reservation-reminder` - Upcoming reservation reminder
- `reservation-prompt` - Check-in prompt at reservation time

### Firebase Cloud Messaging (FCM)

**Client Setup** (`lib/firebase.ts`):

```typescript
const messaging = getMessaging(app);

// Get device token
const token = await getToken(messaging, {
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
});

// Listen for foreground messages
onMessage(messaging, (payload) => {
  new Notification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/android-chrome-192x192.png",
  });
});
```

**Service Worker** (`public/firebase-messaging-sw.js`):

```javascript
// Background message handler
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification.title,
    payload.notification,
  );
});
```

### Notification Preferences

**User Settings**:

```typescript
{
  push_enabled: boolean; // Master toggle
  reminders_enabled: boolean; // Reservation reminders
  group_notifications_enabled: boolean;
  achievement_notifications_enabled: boolean;
  group_join_enabled: boolean; // New member notifications
  checkin_enabled: boolean; // Tent check-in notifications
}
```

### Rate Limiting

**Strategy**:

- Per-notification-type limits
- Per-group limits for social features
- Time-based windows (5 minutes default)
- Database-backed tracking

**Implementation**:

```typescript
// Check rate limit
const recentCount = await supabase.rpc("check_notification_rate_limit", {
  p_user_id: userId,
  p_notification_type: "location_sharing",
  p_group_id: groupId,
  p_minutes_ago: 5,
});

if (recentCount > 0) return; // Skip notification

// Send notification...

// Record rate limit
await supabase.rpc("record_notification_rate_limit", {
  p_user_id: userId,
  p_group_id: groupId,
  p_notification_type: "location_sharing",
});
```

### Novu Service Abstraction

**Service Layer** (`lib/services/notifications.ts`):

```typescript
class NotificationService {
  async subscribeUser(userId, email, firstName, lastName, avatar) {
    await this.novu.subscribers.identify(userId, {
      email,
      firstName,
      lastName,
      avatar,
    });
  }

  async registerFCMToken(userId, token) {
    await this.novu.subscribers.setCredentials(userId, "fcm", {
      deviceTokens: [token],
    });
  }

  async triggerNotification(workflowId, userId, payload) {
    await this.novu.trigger({
      workflowId,
      to: userId,
      payload,
    });
  }
}
```

---

## 7. Key Components & UI Patterns

### Form Handling

**Stack**: React Hook Form + Zod validation

**Pattern**:

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});

const onSubmit = form.handleSubmit(async (data) => {
  await mutateAsync(data);
});

<Form {...form}>
  <FormField
    control={form.control}
    name="fieldName"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Label</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

**Schemas** (`lib/schemas/`):

- Dynamic validation (festival dates in attendance schema)
- Type inference from Zod schemas
- Reusable validation rules

### UI Components (shadcn/ui)

**Base Components**:

- Button, Input, Textarea, Select, Checkbox, Switch
- Dialog, Drawer, Popover, Sheet
- Table, Card, Badge, Avatar
- Command (search/filter), Combobox
- Calendar, DatePicker, DateTimePicker
- Alert, Toast (Sonner)

**Custom Components**:

- `TentSelector`: Multi-select tent picker
- `FestivalSelector`: Festival switcher modal
- `AttendanceDialog`: Quick attendance form
- `PhotoPreview`: Lightbox image viewer
- `ProfilePreview`: User profile quick view
- `LocationPrivacySettings`: Per-group location toggles
- `PhotoPrivacySettings`: Per-group photo visibility
- `AchievementCard`: Achievement display with progress
- `DataTable`: Server-side paginated table

### Responsive Design

**Strategy**:

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- `ResponsiveDialog`: Switches between Dialog (desktop) and Drawer (mobile)
- `useMediaQuery` hook for conditional rendering

### Theming

**Brand Colors** (Yellow theme):

```css
--yellow-400: #fbbf24 /* Light yellow */ --yellow-500: #f59e0b
  /* Primary yellow */ --yellow-600: #d97706 /* Dark yellow */;
```

**Usage**:

- Primary buttons: `bg-yellow-500 hover:bg-yellow-600`
- Text highlights: `text-yellow-600`
- Gradients: Dual yellow for branding

### Loading States

**Patterns**:

- Skeleton loaders (`Skeleton` component)
- Loading spinners (`LoadingSpinner`)
- Suspense boundaries
- Query loading states (`isLoading`, `isRefetching`)

### Error Handling

**Layers**:

1. **ErrorBoundary**: Catches React errors
2. **Sentry**: Error tracking and reporting
3. **Toast notifications**: User-facing error messages
4. **Try-catch**: Server action error handling

---

## 8. API Routes & Server Actions

### API Routes

**Version Check** (`/api/version`):

```typescript
// Returns current app version for update prompts
GET / api / version;
Response: {
  version: "0.7.0";
}
```

**Novu Webhook** (`/api/novu`):

```typescript
// Handles Novu webhook events
POST / api / novu;
```

**Image Proxy** (`/api/image/[id]`):

```typescript
// Proxies and optimizes images from Supabase Storage
GET / api / image / { id };
```

**Location Sharing** (`/api/location-sharing`):

```typescript
// REST API for location updates
POST / api / location - sharing / location;
GET / api / location - sharing / preferences;
POST / api / location - sharing / preferences;
```

**Cron Jobs** (`/api/cron/scheduler`):

```typescript
// Vercel Cron handlers
POST / api / cron / scheduler / reservations; // Every 5 minutes
POST / api / cron / scheduler / achievements; // Hourly
```

### Server Actions by Feature

**Authentication** (`lib/sharedActions.ts`):

- `getUser()` - Get current authenticated user
- `getProfileShort()` - Get minimal profile data
- `getTutorialStatus()` - Check tutorial completion

**Attendance** (`app/(private)/calendar/actions.ts`):

- `addOrUpdateAttendance()` - Create/update attendance + tents
- `deleteAttendance()` - Remove attendance record
- `getUserAttendances()` - Fetch user's festival attendances
- `getAttendanceTents()` - Get tents for specific attendance

**Groups** (`app/(private)/groups/actions.ts`):

- `createGroup()` - Create new group
- `joinGroup()` - Join group by name/password or invite token
- `fetchUserGroups()` - Get user's groups for festival
- `getGroupGallery()` - Fetch group photo gallery
- `getGroupMembers()` - Get group member list

**Achievements** (`lib/actions/achievements.ts`):

- `getUserAchievements()` - Fetch user achievements with progress
- `evaluateAchievements()` - Trigger achievement evaluation
- `getAchievementLeaderboard()` - Ranking by achievement points
- `getUserAchievementStats()` - Breakdown by category/rarity

**Notifications** (`lib/actions/notifications.ts`):

- `syncUserWithNovu()` - Register/update Novu subscriber
- `registerFCMToken()` - Register device token
- `getUserNotificationPreferences()` - Fetch preferences
- `updateUserNotificationPreferences()` - Update preferences
- `sendLocationSharingNotification()` - Notify group members

**Wrapped** (`lib/actions/wrapped.ts`):

- `getWrappedData()` - Generate/fetch wrapped statistics
- `invalidateWrappedCache()` - Clear cached wrapped data

**Admin** (`app/(private)/admin/actions.ts`):

- `regenerateAllWrappedData()` - Admin: regenerate all users' wrapped
- `getUserList()` - Admin: fetch all users
- `getGroupList()` - Admin: fetch all groups

---

## 9. Recommendations for Expo Migration

### Critical Differences

#### 1. **No Server Components**

- **Next.js**: Server Components, Server Actions
- **Expo**: All components are client-side
- **Solution**: Convert server actions to REST API or tRPC endpoints

#### 2. **Navigation**

- **Next.js**: File-based routing (App Router)
- **Expo**: Expo Router (similar file-based) or React Navigation
- **Recommendation**: Use Expo Router for similar DX

#### 3. **Authentication**

- **Next.js**: Cookie-based sessions
- **Expo**: Token-based (AsyncStorage + secure storage)
- **Solution**: Supabase has React Native SDK with proper session management

#### 4. **Push Notifications**

- **Web**: FCM via service workers
- **Native**: Expo Notifications + FCM (iOS + Android)
- **Solution**: Expo Notifications API with device push tokens

#### 5. **Image Handling**

- **Web**: Next.js Image optimization
- **Native**: Expo Image, react-native-fast-image
- **Solution**: Expo Image with caching

#### 6. **Storage**

- **Web**: Supabase Storage with signed URLs
- **Native**: Same approach, use Supabase SDK
- **Solution**: Keep Supabase Storage, handle uploads with `expo-image-picker`

### Recommended Tech Stack for Expo

```json
{
  "framework": "Expo SDK 51+",
  "language": "TypeScript",
  "navigation": "Expo Router (file-based)",
  "state": "TanStack Query (React Query) - keep abstraction!",
  "auth": "@supabase/supabase-js (React Native)",
  "database": "Supabase (same backend)",
  "forms": "React Hook Form + Zod (same as web)",
  "ui": "Expo-compatible alternatives:",
  "components": [
    "react-native-paper (Material Design)",
    "react-native-elements",
    "Custom components with react-native-reanimated"
  ],
  "notifications": "expo-notifications + Novu",
  "location": "expo-location",
  "camera": "expo-camera + expo-image-picker",
  "maps": "react-native-maps",
  "charts": "react-native-chart-kit or victory-native"
}
```

### Migration Strategy

#### Phase 1: Foundation

1. Set up Expo project with TypeScript
2. Configure Expo Router (replicate route structure)
3. Set up Supabase React Native client
4. Implement authentication flow
5. Port data abstraction layer (keep React Query)

#### Phase 2: Core Features

1. Festival context (AsyncStorage for persistence)
2. Attendance tracking (camera integration)
3. Group management (QR code scanning with `expo-barcode-scanner`)
4. Leaderboard views
5. Profile management

#### Phase 3: Advanced Features

1. Achievement system
2. Photo gallery with camera integration
3. Push notifications (Expo Notifications)
4. Location sharing (expo-location + maps)
5. Offline support (React Query persistence)

#### Phase 4: Polish

1. Wrapped feature (animations with `react-native-reanimated`)
2. Reservation system
3. News feed
4. Admin panel (if needed)
5. Deep linking
6. App store deployment

### Code Reusability

**High Reusability** (95%+):

- TypeScript types (`lib/database.types.ts`)
- Zod schemas (`lib/schemas/`)
- Business logic hooks (`hooks/`)
- Data abstraction layer (`lib/data/`)
- Utility functions (`lib/utils/`)
- Constants (`lib/constants.ts`)

**Medium Reusability** (50-70%):

- Form logic (React Hook Form patterns)
- State management patterns
- API interaction logic
- Notification service abstraction

**Low Reusability** (requires rewrite):

- UI components (shadcn/ui → React Native components)
- Navigation (Next.js routing → Expo Router)
- Server actions (→ REST API calls)
- Service workers (→ native background tasks)
- PWA features (→ native equivalents)

### Key Expo Packages

```json
{
  "expo": "~51.0.0",
  "expo-router": "~4.0.0",
  "expo-notifications": "~0.28.0",
  "expo-location": "~17.0.0",
  "expo-camera": "~15.0.0",
  "expo-image-picker": "~15.0.0",
  "expo-barcode-scanner": "~13.0.0",
  "expo-secure-store": "~13.0.0",
  "@react-native-async-storage/async-storage": "^1.23.0",
  "@supabase/supabase-js": "^2.39.0",
  "@tanstack/react-query": "^5.0.0",
  "react-hook-form": "^7.0.0",
  "zod": "^4.0.0",
  "react-native-maps": "^1.14.0",
  "react-native-paper": "^5.12.0",
  "react-native-reanimated": "~3.10.0",
  "react-native-gesture-handler": "~2.16.0"
}
```

### Supabase React Native Setup

```typescript
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

### Navigation Structure (Expo Router)

```
app/
├── (auth)/           # Auth stack (no bottom tabs)
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/           # Main app (with bottom tabs)
│   ├── index.tsx              # Home
│   ├── calendar.tsx           # Calendar
│   ├── groups.tsx             # Groups list
│   ├── leaderboard.tsx        # Leaderboard
│   └── profile.tsx            # Profile
├── group/
│   └── [id].tsx               # Group detail (with nested navigator)
├── achievement/
│   └── index.tsx              # Achievement list
├── wrapped/
│   └── index.tsx              # Wrapped feature
└── _layout.tsx                # Root layout with providers
```

### Push Notifications (Expo)

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

// Get push token
const token = (
  await Notifications.getExpoPushTokenAsync({
    projectId: "your-project-id",
  })
).data;

// Register with Novu
await registerFCMToken(token);

// Listen for notifications
Notifications.addNotificationReceivedListener((notification) => {
  // Handle foreground notification
});

Notifications.addNotificationResponseReceivedListener((response) => {
  // Handle notification tap (deep link)
});
```

### Location Sharing (Expo)

```typescript
import * as Location from "expo-location";

// Request permissions
const { status } = await Location.requestForegroundPermissionsAsync();

// Watch location
const subscription = await Location.watchPositionAsync(
  {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 30000, // 30 seconds
    distanceInterval: 10, // 10 meters
  },
  (location) => {
    updateLocationOnServer(location.coords);
  },
);
```

### Camera Integration

```typescript
import * as ImagePicker from "expo-image-picker";

const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: true,
  quality: 0.8,
  exif: false,
});

if (!result.canceled) {
  // Upload images to Supabase Storage
  for (const asset of result.assets) {
    await uploadImage(asset.uri);
  }
}
```

### Deep Linking

```typescript
// expo-router handles most deep linking automatically

// app.json configuration
{
  "expo": {
    "scheme": "prostcounter",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "https",
              "host": "prostcounter.fun",
              "pathPrefix": "/r"
            }
          ]
        }
      ]
    },
    "ios": {
      "associatedDomains": ["applinks:prostcounter.fun"]
    }
  }
}
```

### Offline Support

```typescript
import { onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

// Sync online status
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

// Configure React Query for offline
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});
```

---

## 10. Additional Considerations

### Performance Optimization

**Web (Next.js)**:

- React Server Components (zero JS for static parts)
- Automatic code splitting
- Image optimization (next/image)
- Caching at multiple layers

**Expo Recommendations**:

- Use `React.memo()` for expensive components
- `useMemo()` and `useCallback()` judiciously
- Virtualized lists (`FlashList` instead of `FlatList`)
- Image caching (react-native-fast-image)
- Lazy loading with `React.lazy()` and Suspense

### Security Considerations

**Both Platforms**:

- RLS policies on all tables
- Input validation (Zod schemas)
- Secure token storage (Expo SecureStore)
- HTTPS only
- Rate limiting on APIs

**Expo-Specific**:

- Use `expo-secure-store` for sensitive data (not AsyncStorage)
- Implement certificate pinning for API calls
- Obfuscate sensitive code with ProGuard (Android)

### Testing Strategy

**Unit Tests**:

- Business logic hooks (Vitest)
- Utility functions
- Validation schemas

**Integration Tests**:

- API interactions
- Database queries
- Auth flows

**E2E Tests** (Expo):

- Detox (React Native E2E framework)
- Maestro (newer alternative)

### Deployment

**Expo Deployment**:

1. **Development**: `npx expo start`
2. **Preview Builds**: EAS Build (on-device testing)
3. **Production**: EAS Submit (App Store + Google Play)
4. **OTA Updates**: EAS Update (instant updates without app store)

**CI/CD**:

- GitHub Actions for automated builds
- EAS Build for native builds
- Automated testing pipeline
- Version management

### Analytics & Monitoring

**Expo Recommendations**:

- **Analytics**: Expo Analytics or Firebase Analytics
- **Error Tracking**: Sentry (same as web)
- **Performance**: React Native Performance Monitor
- **User Feedback**: In-app feedback forms

### Backend Compatibility

**No Changes Required**:

- Supabase database (same schema)
- Supabase Auth (React Native SDK)
- Supabase Storage (same API)
- Novu (same workflow triggers)
- Database functions (same RPC calls)

**Considerations**:

- Convert Next.js API routes to serverless functions if needed
- Keep server actions → REST API mapping documented
- Maintain API versioning for backward compatibility

### Database considerations

- Keep daily “attendance” as the header record only
  - One per user per festival per day (unique on user_id, festival_id, date).
  - No price fields on attendance; it’s just the day-scoped container and aggregate cache.

- Introduce per-beer “consumptions” (line items)
  - New table linked to attendance_id with: tent_id, recorded_at, price_paid_cents, base_price_cents, tip_cents (price_paid − base), currency, volume_liters (optional), idempotency_key.
  - Each row captures the exact amount paid so tips/round-ups are preserved.

- Normalize “base price” sources
  - Festival-level default beer price (single source).
  - Per-tent-per-festival override table; effective base price = tent override OR festival default.
  - Do not store base price elsewhere; snapshot base_price_cents only in consumptions.

- Derive totals instead of duplicating
  - attendance.total_beers = count(consumptions).
  - attendance.total_spent_cents = sum(consumptions.price_paid_cents).
  - Optionally cache these on attendances with a trigger; otherwise compute via views.

- Multi-tent in a single day
  - Consumptions carry tent_id, so multiple tents per day are naturally supported.

- Data types and integrity
  - Store money as integer cents (no floats).
  - recorded_at as timestamptz; enforce it falls within the festival day window if needed.
  - Unique(user_id, festival_id, date) on attendances is retained (already implied by current upsert pattern).

- App/API flow
  - “Quick add” pre-fills base from tent/festival, user edits price to include tip; server computes tip_cents.
  - Use idempotency_key on consumptions to make retries safe.

- Migration notes
  - Backfill: explode existing attendance beer_count into N consumptions with base_price_cents from tent/festival default, mark as estimated.
  - Remove any scattered beer price fields from other tables to avoid divergence.

- Live location: drop and replace
  - Drop current tables and policies related to live location: public.user_locations, public.location_sharing_preferences, and their RLS policies (e.g., “Users can manage own location preferences”, “Group members can view group location preferences”).
  - New model: location_sessions (ownership/visibility), location_session_members (who can view), location_points (append-only points).
  - RLS: owners/moderators manage sessions; only listed members can read points.
  - Ops: retention window (e.g., 24–48h), BRIN index on recorded_at, optional PostGIS later; Realtime for streaming updates.

---

## 11. Summary & Next Steps

### Project Strengths

1. **Well-Architected**: Clean separation of concerns, provider-agnostic abstractions
2. **Type-Safe**: Full TypeScript coverage, Zod validation
3. **Modern Stack**: Latest React patterns, server components, React Query
4. **Feature-Rich**: Comprehensive gamification, social features, real-time capabilities
5. **Scalable**: Multi-festival architecture, RLS policies, caching strategies

### Migration Feasibility

- **High**: Most business logic is reusable
- **TypeScript types & schemas**: 100% reusable
- **Hooks & utilities**: 95% reusable with minor tweaks
- **UI components**: Need complete rewrite for React Native
- **Navigation**: Straightforward mapping to Expo Router

### Recommended First Steps

1. **Prototype Core Flow**:
   - Set up Expo project
   - Implement authentication
   - Create home screen with quick attendance
   - Test Supabase integration

2. **Validate Feasibility**:
   - Confirm push notifications work
   - Test camera integration
   - Verify location sharing
   - Ensure offline support

3. **Incremental Migration**:
   - Port features one by one
   - Run web + mobile in parallel
   - Share backend completely
   - Gradually achieve feature parity

4. **Testing & Optimization**:
   - Performance profiling
   - Battery usage optimization
   - Network efficiency
   - User acceptance testing

### Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [TanStack Query React Native](https://tanstack.com/query/latest/docs/react/overview)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-27
**Author**: Claude Code Analysis
**Project Version**: 0.7.0
