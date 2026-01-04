---
feature: Leaderboard
priority: high
---

# Leaderboard Flows

The global leaderboard shows rankings across all users for the current festival.

## FLOW_LDB_001: View Global Leaderboard

### Description
User views the global leaderboard showing all users ranked by the selected winning criteria.

### Preconditions
- User is signed in
- A festival is active/selected

### Test Data
- Any authenticated test user

### Steps
1. Navigate to `/leaderboard`
2. Wait for page to load
3. Observe the leaderboard table

### Expected Results
- "Global Leaderboard" heading is visible
- Winning criteria selector is visible
- Leaderboard table shows user rankings (if data exists)

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Page heading | Role | heading, "Global Leaderboard" |
| Winning criteria label | Text | /winning criteria/i |
| Leaderboard table | Role | table |

### E2E Test Reference
- **File**: `e2e/specs/leaderboard.spec.ts`
- **Test**: `should display global leaderboard page`

---

## FLOW_LDB_002: Change Winning Criteria

### Description
User changes the winning criteria to view different rankings.

### Preconditions
- User is on the leaderboard page
- Leaderboard data is loaded

### Test Data
- Any authenticated test user

### Steps
1. Navigate to `/leaderboard`
2. Click on the winning criteria dropdown
3. Select a different criteria (e.g., "Total Beers", "Days Attended")
4. Wait for leaderboard to update

### Expected Results
- Dropdown shows available criteria options
- Leaderboard updates to reflect new sorting criteria
- Selected criteria is shown in dropdown

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Criteria dropdown | Role | combobox |
| Dropdown option | Role | option |

### E2E Test Reference
- **File**: `e2e/specs/leaderboard.spec.ts`
- **Test**: `should change winning criteria`

---

## FLOW_LDB_003: View User Position

### Description
User can see their own position in the leaderboard.

### Preconditions
- User is signed in
- User has attendance data for current festival
- User is on the leaderboard page

### Test Data
- Authenticated user with attendance records

### Steps
1. Navigate to `/leaderboard`
2. Look for current user in the rankings

### Expected Results
- User's entry is visible in the leaderboard (if they have data)
- Entry shows user's stats (days attended, beers, etc.)

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Leaderboard row | Role | row |
| User stats | Role | cell |

### E2E Test Reference
- **File**: `e2e/specs/leaderboard.spec.ts`
- **Test**: `should show user position in leaderboard`
