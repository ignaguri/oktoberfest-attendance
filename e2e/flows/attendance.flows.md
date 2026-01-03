# Attendance Flows

## FLOW_ATT_001: Quick Attendance from Home Page

### Description
User registers their attendance for today from the home page using the quick attendance widget.

### Preconditions
- User is authenticated
- User is on the home page
- It is during the festival dates

### Test Data
- **User**: user9@example.com (password: "password")
- **Tent**: Any available tent from the combobox

### Steps
1. User is on `/home`
2. User sees the "Are you there today?" section
3. User clicks the tent selector combobox
4. User selects a tent from the dropdown
5. User adjusts beer count using +/- buttons (optional)
6. (Attendance is auto-registered when tent is selected)

### Expected Results
- Tent selector shows the selected tent
- Beer count updates accordingly
- User stats in highlights section update

### Selectors
| Element | Locator | Description |
|---------|---------|-------------|
| Tent Selector | `getByRole("combobox", { name: /tent/i })` | Dropdown to select tent |
| Beer Decrement | First button in beer counter section | Decrease beer count |
| Beer Count Display | Text showing "X drank today" | Current count |
| Beer Increment | Second button in beer counter section | Increase beer count |

### E2E Test Reference
- **File**: `e2e/specs/attendance.spec.ts`
- **Test**: `should select a tent from home page`

---

## FLOW_ATT_002: Increment Beer Count

### Description
User increases their beer count for the day using the quick attendance widget.

### Preconditions
- User is authenticated
- User is on the home page
- User has already selected a tent (or will select one)

### Test Data
- **User**: user9@example.com (password: "password")

### Steps
1. User is on `/home`
2. User clicks the + button to increment beer count
3. User sees the count update immediately

### Expected Results
- Beer count increases by 1
- Display updates to show new count

### Selectors
| Element | Locator | Description |
|---------|---------|-------------|
| Beer Increment | Button after the beer count display | + button |
| Beer Count | Text matching "X drank today" | Current beer count |

### E2E Test Reference
- **File**: `e2e/specs/attendance.spec.ts`
- **Test**: `should increment beer count`

---

## FLOW_ATT_003: Decrement Beer Count

### Description
User decreases their beer count for the day using the quick attendance widget.

### Preconditions
- User is authenticated
- User is on the home page
- User has at least 1 beer logged

### Test Data
- **User**: user9@example.com (password: "password")

### Steps
1. User is on `/home` with beer count > 0
2. User clicks the - button to decrement beer count
3. User sees the count update immediately

### Expected Results
- Beer count decreases by 1 (minimum 0)
- Display updates to show new count

### Selectors
| Element | Locator | Description |
|---------|---------|-------------|
| Beer Decrement | Button before the beer count display | - button |
| Beer Count | Text matching "X drank today" | Current beer count |

### E2E Test Reference
- **File**: `e2e/specs/attendance.spec.ts`
- **Test**: `should decrement beer count`

---

## FLOW_ATT_004: Navigate to Full Attendance Page

### Description
User navigates to the full attendance page to view and manage their attendance history.

### Preconditions
- User is authenticated

### Test Data
- **User**: user9@example.com (password: "password")

### Steps
1. User is on `/home`
2. User clicks on "Attendance" in the navigation
3. User is redirected to `/attendance`

### Expected Results
- User sees the attendance page with their history
- Page shows attendance records in a table/list format

### Selectors
| Element | Locator | Description |
|---------|---------|-------------|
| Navigation Link | `getByRole("link", { name: /attendance/i })` | Attendance nav link |

### E2E Test Reference
- **File**: `e2e/specs/attendance.spec.ts`
- **Test**: `should navigate to attendance page`

---

## FLOW_ATT_005: View Attendance History

### Description
User views their attendance history on the attendance page.

### Preconditions
- User is authenticated
- User has previous attendance records

### Test Data
- **User**: user9@example.com (password: "password")
- User9 has seeded attendance data from seed.sql

### Steps
1. User navigates to `/attendance`
2. User sees a table/list of their attendance records
3. Records show date, tent, and beer count

### Expected Results
- Attendance records are displayed
- Records include date, tent name, and beer count
- User can see their historical attendance

### Selectors
| Element | Locator | Description |
|---------|---------|-------------|
| Attendance Table | `getByRole("table")` or data-testid | Table of records |
| Date Column | Table cells with dates | Attendance dates |
| Tent Column | Table cells with tent names | Tent visited |
| Beer Count | Table cells with numbers | Beers consumed |

### E2E Test Reference
- **File**: `e2e/specs/attendance.spec.ts`
- **Test**: `should display attendance history`
