---
feature: Profile
priority: medium
---

# Profile Flows

User profile management including viewing and editing personal information.

## FLOW_PRF_001: View Profile

### Description
User views their profile page with personal information.

### Preconditions
- User is signed in

### Test Data
- Any authenticated test user

### Steps
1. Navigate to `/profile`
2. Wait for page to load

### Expected Results
- "Your Profile" heading is visible
- Avatar is displayed
- Email, Full Name, and Username fields are shown
- Edit button is visible

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Page heading | Role | heading, /your profile/i |
| Email label | Text | /email/i |
| Full Name label | Text | /full name/i |
| Username label | Text | /username/i |
| Edit button | Role | button, "Edit" |

### E2E Test Reference
- **File**: `e2e/specs/profile.spec.ts`
- **Test**: `should display profile page`

---

## FLOW_PRF_002: Edit Profile

### Description
User enables edit mode to update their profile information.

### Preconditions
- User is on the profile page
- Profile data is loaded

### Test Data
- Any authenticated test user

### Steps
1. Navigate to `/profile`
2. Click "Edit" button
3. Update Full Name or Username
4. Click "Update" button
5. Wait for save confirmation

### Expected Results
- Edit mode is enabled (input fields appear)
- Update and Cancel buttons are visible
- After save, success toast appears
- Profile displays updated values

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Edit button | Role | button, "Edit" |
| Full Name input | Role | textbox, "Full Name" |
| Username input | Role | textbox, "Username" |
| Update button | Role | button, /update/i |
| Cancel button | Role | button, "Cancel" |

### E2E Test Reference
- **File**: `e2e/specs/profile.spec.ts`
- **Test**: `should enable edit mode`

---

## FLOW_PRF_003: Cancel Profile Edit

### Description
User cancels profile editing without saving changes.

### Preconditions
- User is in edit mode on profile page

### Steps
1. Click "Edit" button
2. Make changes to fields
3. Click "Cancel" button

### Expected Results
- Edit mode is disabled
- Changes are not saved
- Original values remain displayed

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Cancel button | Role | button, "Cancel" |

### E2E Test Reference
- **File**: `e2e/specs/profile.spec.ts`
- **Test**: `should cancel edit mode`

---

## FLOW_PRF_004: Navigate to Change Password

### Description
User navigates to the change password page from profile.

### Preconditions
- User is on the profile page

### Steps
1. Navigate to `/profile`
2. Click "Change Password" link/button

### Expected Results
- User is redirected to `/update-password`

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Change Password link | Role | link, /change password/i |

### E2E Test Reference
- **File**: `e2e/specs/profile.spec.ts`
- **Test**: `should navigate to change password`

---

## FLOW_PRF_005: Reset Tutorial

### Description
User resets the app tutorial to see it again.

### Preconditions
- User is on the profile page

### Steps
1. Scroll to Tutorial section
2. Click "Reset Tutorial" button
3. Wait for confirmation

### Expected Results
- Success toast appears confirming tutorial reset
- Tutorial will show on next home page visit

### Selectors
| Element | Locator | Value |
|---------|---------|-------|
| Tutorial heading | Role | heading, "Tutorial" |
| Reset button | Role | button, /reset tutorial/i |

### E2E Test Reference
- **File**: `e2e/specs/profile.spec.ts`
- **Test**: `should reset tutorial`
