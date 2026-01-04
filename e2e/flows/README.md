# User Flow Registry

This directory contains documented user flows for ProstCounter. Each flow can be:
- Used as a **manual testing checklist**
- Referenced by **automated E2E tests** in `e2e/specs/`

## Flow Document Structure

Each `.flows.md` file documents flows for a specific feature area:

| File | Feature | E2E Tests |
|------|---------|-----------|
| `auth.flows.md` | Authentication (sign-in, sign-out) | `specs/auth.spec.ts` |
| `attendance.flows.md` | Attendance registration | `specs/attendance.spec.ts` |
| `groups.flows.md` | Group management | `specs/groups.spec.ts` |
| `leaderboard.flows.md` | Leaderboard viewing | `specs/leaderboard.spec.ts` |
| `profile.flows.md` | Profile management | `specs/profile.spec.ts` |
| `calendar.flows.md` | Calendar & reservations | `specs/calendar.spec.ts` |

## Flow Format

Each flow follows this structure:

```markdown
## FLOW_XXX_001: Flow Name

### Description
What the user is trying to accomplish.

### Preconditions
- Required state before starting this flow

### Test Data
- Specific accounts/data to use

### Steps
1. Navigate to page
2. Perform action
3. ...

### Expected Results
- What should happen when complete

### Selectors (for E2E tests)
| Element | Locator | Value |
|---------|---------|-------|
| Submit button | Role | button, "Submit" |

### E2E Test Reference
- **File**: `e2e/specs/xxx.spec.ts`
- **Test**: `should do something`
```

## Priority Levels

Flows are tagged with priority in YAML frontmatter:
- **critical**: Core user journeys (auth, attendance, groups)
- **high**: Important features (leaderboard, profile)
- **medium**: Secondary features (calendar, achievements)
- **low**: Edge cases and admin flows

## Running Tests

```bash
# Run all E2E tests
pnpm e2e

# Run with browser visible
pnpm e2e:headed

# Run specific test file
pnpm exec playwright test e2e/specs/auth.spec.ts
```

## Test Data

Seeded test users (from `supabase/seed.sql`):
- **Email**: `user1@example.com` through `user10@example.com`
- **Password**: `password` (same for all)
- **Default test user**: `user9@example.com`

Seeded groups:
- **Group A** (password: `passwordA`)
- **Group B** (password: `passwordB`)
- **Group C** (password: `passwordC`)

## Page Objects

Reusable page objects are in `e2e/pages/`:
- `base.page.ts` - Base class with common methods
- `sign-in.page.ts` - Sign-in page interactions
- `home.page.ts` - Home dashboard interactions
- `groups.page.ts` - Groups page interactions
- etc.
