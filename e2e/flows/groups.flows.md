---
feature: Groups
priority: critical
---

# Groups Flows

Groups allow users to compete with friends and track beer consumption together during festivals.

## FLOW_GRP_001: View My Groups

### Description
User views their list of joined groups on the groups page.

### Preconditions
- User is signed in
- User navigates to /groups page

### Test Data
- Any authenticated test user (user1-10@example.com)

### Steps
1. Navigate to `/groups`
2. Wait for page to load
3. Observe the "My Groups" section

### Expected Results
- Groups page is displayed
- "Groups" heading is visible
- My Groups section shows user's joined groups (if any)
- Join and Create group forms are visible

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Page heading | Role | heading, "Groups" |
| My Groups section | Text | /my groups/i |
| Join form heading | Role | heading, "Join a Group" |
| Create form heading | Role | heading, "Create a New Group" |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should display groups page with forms`

---

## FLOW_GRP_002: Join a Group

### Description
User joins an existing group using the group name and password.

### Preconditions
- User is signed in
- User is on the /groups page
- A group exists with known name and password

### Test Data
- **Group Name**: "Group A" (seeded)
- **Password**: "passwordA" (seeded)

### Steps
1. Navigate to `/groups`
2. Fill in "Group Name" field with group name
3. Fill in "Group Password" field with password
4. Click "Join Group" button
5. Wait for redirect to group detail page

### Expected Results
- Toast message "Successfully joined the group!" appears
- User is redirected to `/groups/{groupId}`
- Group leaderboard is visible

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Group name input | Placeholder | "Group Name" |
| Password input | Placeholder | "Group Password" |
| Join button | Role | button, "Join Group" |
| Success toast | Data attribute | [data-sonner-toast] |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should join a group with valid credentials`

---

## FLOW_GRP_003: Create a New Group

### Description
User creates a new group with a custom name and password.

### Preconditions
- User is signed in
- User is on the /groups page

### Test Data
- **Group Name**: Generated unique name (e.g., "E2E Test Group {timestamp}")
- **Password**: "testpassword123"

### Steps
1. Navigate to `/groups`
2. Scroll to "Create a New Group" section
3. Fill in "Group Name" field
4. Fill in "Group Password" field
5. Click "Create Group" button
6. Wait for redirect to group settings page

### Expected Results
- Toast message "Group created successfully!" appears
- User is redirected to `/group-settings/{groupId}`
- Group settings form shows the new group details

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Create form heading | Role | heading, "Create a New Group" |
| Group name input | Placeholder | "Group Name" (in create form) |
| Password input | Placeholder | "Group Password" (in create form) |
| Create button | Role | button, "Create Group" |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should create a new group`

---

## FLOW_GRP_004: View Group Detail

### Description
User views a group's detail page with leaderboard and navigation options.

### Preconditions
- User is signed in
- User is a member of the group

### Test Data
- Any group the user has joined

### Steps
1. Navigate to `/groups/{groupId}` or click on group from My Groups
2. Wait for page to load

### Expected Results
- Group name is displayed as heading
- Leaderboard shows group members' stats
- Calendar, Gallery, and Group Settings buttons are visible
- Share and QR buttons are available

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Group heading | Role | heading (contains group name) |
| Leaderboard | Role | table |
| Calendar button | Role | link, /calendar/i |
| Gallery button | Role | link, /gallery/i |
| Settings button | Role | link, /group settings/i |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should display group detail page`

---

## FLOW_GRP_005: Navigate to Group Settings

### Description
User navigates from group detail page to group settings.

### Preconditions
- User is signed in
- User is a member of the group
- User is on the group detail page

### Steps
1. From group detail page, click "Group Settings" button
2. Wait for navigation to settings page

### Expected Results
- User is redirected to `/group-settings/{groupId}`
- Group Settings heading is visible
- Group details form is displayed

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Settings button | Role | link, "Group Settings" |
| Settings heading | Role | heading, "Group Settings" |
| Group name input | Role | textbox, "Group Name" |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should navigate to group settings`

---

## FLOW_GRP_006: Join Group Error - Wrong Password

### Description
User attempts to join a group with incorrect password.

### Preconditions
- User is signed in
- User is on the /groups page
- Group exists but user provides wrong password

### Test Data
- **Group Name**: "Group A"
- **Password**: "wrongpassword"

### Steps
1. Navigate to `/groups`
2. Fill in "Group Name" with valid group name
3. Fill in "Group Password" with incorrect password
4. Click "Join Group" button

### Expected Results
- Error toast appears with message about incorrect password
- User remains on /groups page
- User is not added to the group

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Error toast | Data attribute | [data-sonner-toast] |
| Toast content | Text | /incorrect password/i |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should show error for wrong group password`

---

## FLOW_GRP_007: View Group Members

### Description
User views the list of group members in group settings.

### Preconditions
- User is signed in
- User is a member of the group
- User navigates to group settings

### Steps
1. Navigate to `/group-settings/{groupId}`
2. Scroll to "Group Members" section

### Expected Results
- Members table is visible
- Table shows username and name columns
- Current members are listed

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Members heading | Role | heading, "Group Members" |
| Members table | Role | table |
| Username column | Role | columnheader, "Username" |

### E2E Test Reference
- **File**: `e2e/specs/groups.spec.ts`
- **Test**: `should display group members list`
