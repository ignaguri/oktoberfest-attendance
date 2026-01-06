---
feature: Achievements
priority: medium
---

# Achievements Flows

User achievements and progress tracking.

## FLOW_ACH_001: View Achievements Page

### Description

User views their achievements page with stats and progress.

### Preconditions

- User is signed in
- A festival is selected

### Test Data

- Any authenticated test user

### Steps

1. Navigate to `/achievements`
2. Wait for page to load

### Expected Results

- "Achievements" heading is visible with emoji
- Stats cards are displayed (Total Progress, Total Points, etc.)
- Achievement grid is shown

### Selectors

| Element         | Locator | Value                    |
| --------------- | ------- | ------------------------ |
| Page heading    | Role    | heading, /achievements/i |
| Stats cards     | Role    | article (multiple)       |
| Category filter | Role    | combobox                 |

### E2E Test Reference

- **File**: `e2e/specs/achievements.spec.ts`
- **Test**: `should display achievements page`

---

## FLOW_ACH_002: View Achievement Stats

### Description

User views their achievement statistics (progress, points, breakdown).

### Preconditions

- User is on the achievements page
- Page is loaded with data

### Steps

1. Navigate to `/achievements`
2. View stats cards

### Expected Results

- Total Progress card shows unlocked/total ratio
- Total Points card shows points earned
- Rarity Breakdown card shows unlocked by rarity
- Categories card shows breakdown by category

### Selectors

| Element          | Locator | Value               |
| ---------------- | ------- | ------------------- |
| Total Progress   | Text    | /total progress/i   |
| Total Points     | Text    | /total points/i     |
| Rarity Breakdown | Text    | /rarity breakdown/i |
| Categories       | Text    | /categories/i       |

### E2E Test Reference

- **File**: `e2e/specs/achievements.spec.ts`
- **Test**: `should show achievement stats`

---

## FLOW_ACH_003: Filter Achievements by Category

### Description

User filters achievements by category.

### Preconditions

- User is on the achievements page

### Steps

1. Navigate to `/achievements`
2. Click the category filter dropdown
3. Select a category (e.g., "Beer Achievements")

### Expected Results

- Dropdown shows category options
- After selection, achievements are filtered
- Badge counts update to show filtered counts

### Selectors

| Element           | Locator | Value       |
| ----------------- | ------- | ----------- |
| Category dropdown | Role    | combobox    |
| Category option   | Role    | option      |
| Unlocked badge    | Text    | /unlocked/i |
| Locked badge      | Text    | /locked/i   |

### E2E Test Reference

- **File**: `e2e/specs/achievements.spec.ts`
- **Test**: `should filter achievements by category`

---

## FLOW_ACH_004: View Achievement Progress

### Description

User views the progress of their achievements.

### Preconditions

- User is on the achievements page

### Steps

1. Navigate to `/achievements`
2. View achievement grid sections

### Expected Results

- Completed achievements shown under "Completed" heading
- In-progress achievements shown under "In Progress" heading
- Each achievement shows progress bar or completion status

### Selectors

| Element             | Locator | Value                  |
| ------------------- | ------- | ---------------------- |
| Completed heading   | Text    | /completed/i           |
| In Progress heading | Text    | /in progress/i         |
| Achievement cards   | Generic | Achievement grid items |

### E2E Test Reference

- **File**: `e2e/specs/achievements.spec.ts`
- **Test**: `should show achievement progress sections`
