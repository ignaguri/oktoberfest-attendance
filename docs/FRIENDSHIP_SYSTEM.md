# Friendship System

> Added: 2026-03-18

## Overview

ProstCounter has two social visibility mechanisms:

1. **Groups** — users who share a group can see each other's activity within that group's festival
2. **Friendships** — mutual connections that grant cross-group, cross-festival visibility

Friendships are independent of groups. Two users can be friends without sharing any group, and group members are not automatically friends.

## How It Works

### Request/Accept Flow

Friendships are mutual and require both parties to agree:

1. User A sends a friend request to User B
2. User B receives the request and can **accept** or **decline**
3. If accepted, both users become friends
4. Either user can **unfriend** the other at any time

Duplicate and reverse requests are handled at the database level — if A requests B while B already requested A, the existing request is automatically accepted.

### Discovery

Users can find others to befriend through:

- **Search** — by username or full name
- **Suggestions** — "People you may know" based on shared group membership
- **QR codes** — each profile has a scannable QR code (mobile)

## What Friendship Implies

Once two users are friends, they gain full visibility into each other's festival activity — the same level of visibility that group members have with each other, but across **all** festivals.

### Visibility Granted

| Data | Without Friendship | With Friendship |
|------|-------------------|-----------------|
| Activity feed (beer counts) | Only group members | Group members + friends |
| Tent check-ins | Only group members | Group members + friends |
| Beer photos | Only group members | Group members + friends |
| Reservations | Only group members | Group members + friends |
| Messages | Only group members | Group members + friends |

### Key Differences from Groups

| Aspect | Groups | Friendships |
|--------|--------|-------------|
| Scope | Tied to a specific festival | Global, across all festivals |
| Creation | One user creates, others join via invite | Mutual request/accept |
| Size | Many members | Always 1-to-1 |
| Removal | Leave the group | Unfriend |
| Auto-visibility | Immediate on join | Immediate on accept |

## Database Design

### Tables

- **`friendships`** — stores all friendship records with `status` enum (`pending`, `accepted`, `declined`)
- Unique constraint on `(requester_id, addressee_id)` prevents duplicate requests
- Check constraint prevents self-friendships

### Helper Function

```sql
is_friend(user1 uuid, user2 uuid) → boolean
```

Returns `true` if the two users have an accepted friendship. Used in RLS policies across the app.

### RLS Integration

Existing RLS policies on `attendances`, `tent_visits`, `beer_pictures`, `reservations`, and `group_messages` were updated to add:

```sql
OR is_friend(auth.uid(), table.user_id)
```

The `activity_feed` view includes a `user_friends` CTE that unions friend activities alongside group member activities.

### SECURITY DEFINER Functions

Friend operations (send, accept, decline) use `SECURITY DEFINER` functions to handle edge cases atomically:

- **`send_friend_request`** — checks for existing/reverse requests, auto-accepts if reverse exists
- **`accept_friend_request`** — validates the addressee is the one accepting
- **`decline_friend_request`** — validates the addressee is the one declining

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/friends` | List accepted friends |
| `GET` | `/friends/requests/incoming` | Pending incoming requests |
| `GET` | `/friends/requests/outgoing` | Pending outgoing requests |
| `GET` | `/friends/requests/count` | Badge count for pending requests |
| `POST` | `/friends/request` | Send friend request |
| `POST` | `/friends/request/:id/accept` | Accept request |
| `POST` | `/friends/request/:id/decline` | Decline request |
| `DELETE` | `/friends/request/:id` | Cancel outgoing request |
| `DELETE` | `/friends/:userId` | Unfriend |
| `GET` | `/friends/suggestions` | People you may know |
| `GET` | `/friends/search?q=` | Search users by name/username |
| `GET` | `/friends/status/:userId` | Friendship status with a user |

## Profile Modal Integration

Tapping any user's avatar (activity feed, leaderboard, friends list) opens a profile modal that includes friendship-aware elements:

### Friendship Badge

Displayed between the user's name and their stats:

| Status | Display |
|--------|---------|
| `self` | Hidden (own profile) |
| `friends` | Green "Friends" badge with check icon |
| `pending_sent` | Muted "Request Sent" badge with clock icon |
| `pending_received` | "Accept Request" button (primary action) |
| `none` | "Add Friend" button (primary action) |

Buttons trigger mutations (`useSendFriendRequest`, `useAcceptFriendRequest`) and the modal updates immediately via cache invalidation of the `public-profile` query key.

### Shared Groups

Below the stats, a "X shared groups" line appears when the current user and the viewed user are both members of one or more groups. Hidden when 0 or when viewing own profile.

### Data Source

Both fields (`friendshipStatus`, `sharedGroups`) come from the existing `GET /profiles/{userId}` endpoint, so the modal requires no additional API calls. The endpoint:

1. Gets the current user from `supabase.auth.getUser()`
2. Queries `friendships` table for the relationship between the two users
3. Counts shared groups via `group_members` table intersection
4. Returns everything in a single response

### Components

- **Web**: `FriendshipBadge` in `apps/web/components/ui/profile-preview.tsx`
- **Mobile**: `MobileFriendshipBadge` in `apps/mobile/components/shared/user-profile-modal.tsx`

## Shared Code

- **Schemas**: `packages/shared/src/schemas/friend.schema.ts`
- **Hooks**: `packages/shared/src/hooks/useFriends.ts` — 12 hooks for all friend operations
- **i18n**: Keys under `friends.*` in all 3 locales (EN, DE, ES)

## Migrations

1. **`20260317150000_add_friendship_system.sql`** — tables, indexes, RLS, SECURITY DEFINER functions
2. **`20260317150001_friendship_visibility_updates.sql`** — updates to existing RLS policies and activity feed view
