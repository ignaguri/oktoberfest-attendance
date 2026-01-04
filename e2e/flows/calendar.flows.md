---
feature: Calendar
priority: medium
---

# Calendar Flows

Personal calendar with event visualization and attendance/reservation management.

## FLOW_CAL_001: View Calendar Page

### Description
User views their personal calendar with attendance and reservation events.

### Preconditions
- User is signed in

### Test Data
- Any authenticated test user

### Steps
1. Navigate to `/calendar`
2. Wait for page to load

### Expected Results
- "My Calendar" heading is visible
- Calendar component is displayed
- Current festival month is shown

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Page heading | Role | heading, "My Calendar" |
| Calendar card | Role | article OR generic with calendar |
| Selected date | Role | button OR gridcell (selected) |

### E2E Test Reference
- **File**: `e2e/specs/calendar.spec.ts`
- **Test**: `should display calendar page`

---

## FLOW_CAL_002: Select Date on Calendar

### Description
User selects a specific date on the calendar to view events.

### Preconditions
- User is on the calendar page
- Calendar is loaded

### Steps
1. Navigate to `/calendar`
2. Click on a date within the festival period
3. View events for that date

### Expected Results
- Date is selected (highlighted)
- Date is shown in footer section
- Events list updates (shows "No events" or list of events)

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Date button | Role | gridcell |
| Selected date display | Text | Date format (e.g., "September 21, 2024") |
| No events message | Text | /no events/i |

### E2E Test Reference
- **File**: `e2e/specs/calendar.spec.ts`
- **Test**: `should select a date on calendar`

---

## FLOW_CAL_003: View Attendance Action Buttons

### Description
User sees action buttons for adding attendance or reservations.

### Preconditions
- User is on the calendar page
- A date is selected

### Steps
1. Navigate to `/calendar`
2. Select a date
3. View action buttons

### Expected Results
- "+Attendance" button is visible
- "+Reservation" button is visible (or disabled if reservation exists)

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Attendance button | Role | button, /\+attendance/i |
| Reservation button | Role | button, /\+reservation/i |

### E2E Test Reference
- **File**: `e2e/specs/calendar.spec.ts`
- **Test**: `should show attendance and reservation buttons`

---

## FLOW_CAL_004: Navigate to Add Attendance

### Description
User clicks the +Attendance button to add attendance for selected date.

### Preconditions
- User is on the calendar page
- A date is selected

### Steps
1. Navigate to `/calendar`
2. Select a date
3. Click "+Attendance" button

### Expected Results
- User is navigated to `/calendar/edit-attendance` with date parameter
- OR attendance form/modal is displayed

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Attendance button | Role | button, /\+attendance/i |

### E2E Test Reference
- **File**: `e2e/specs/calendar.spec.ts`
- **Test**: `should navigate to add attendance`

---

## FLOW_CAL_005: View Events for Date with Activity

### Description
User views events displayed for a date that has attendance data.

### Preconditions
- User is on the calendar page
- User has attendance data for some dates

### Steps
1. Navigate to `/calendar`
2. Select a date with events (marked with indicator)

### Expected Results
- Events are displayed in the footer section
- Beer summary shows daily total
- Tent visits show with timestamps

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Event item | Text | Contains event title |
| Beer summary | Text | /daily total/i |
| No events | Text | /no events/i |

### E2E Test Reference
- **File**: `e2e/specs/calendar.spec.ts`
- **Test**: `should display events for date with activity`
