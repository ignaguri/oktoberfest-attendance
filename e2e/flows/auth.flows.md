---
feature: Authentication
priority: critical
---

# Authentication Flows

Authentication is a critical flow that gates access to all app features.

## FLOW_AUTH_001: Sign In with Email/Password

### Description

User signs in to the app using their email and password credentials.

### Preconditions

- User has an existing account (seeded or registered)
- User is not currently signed in
- User is on the sign-in page

### Test Data

- **Email**: `user9@example.com` (default test user)
- **Password**: `password`
- Alternative users: `user1@example.com` through `user10@example.com`

### Steps

1. Navigate to `/sign-in`
2. Enter email in the email input field
3. Enter password in the password input field
4. Click the "Sign in" button
5. Wait for redirect to `/home`

### Expected Results

- User is redirected to `/home` after successful sign-in
- User session is established (auth cookies set)
- Home page displays user's data (groups, attendance, etc.)

### Selectors

| Element        | Locator | Value             |
| -------------- | ------- | ----------------- |
| Email input    | Label   | /email/i          |
| Password input | Label   | /password/i       |
| Sign in button | Role    | button, "Sign in" |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should sign in with valid credentials`

---

## FLOW_AUTH_002: Sign Out

### Description

User signs out of the app, ending their session.

### Preconditions

- User is currently signed in
- User is on any authenticated page

### Test Data

- Any authenticated test user

### Steps

1. Click on the user avatar/menu in the navbar
2. Click "Sign out" option
3. Wait for redirect to sign-in page

### Expected Results

- User is redirected to `/sign-in` page
- User session is cleared (auth cookies removed)
- Attempting to access `/home` redirects back to `/sign-in`

### Selectors

| Element           | Locator | Value                |
| ----------------- | ------- | -------------------- |
| User menu trigger | Role    | button (avatar area) |
| Sign out link     | Role    | link, "Sign out"     |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should sign out successfully`

---

## FLOW_AUTH_003: Sign In Error - Invalid Credentials

### Description

User attempts to sign in with incorrect credentials and sees an error message.

### Preconditions

- User is not currently signed in
- User is on the sign-in page

### Test Data

- **Email**: `nonexistent@example.com` or valid email with wrong password
- **Password**: `wrongpassword`

### Steps

1. Navigate to `/sign-in`
2. Enter invalid email or password
3. Click the "Sign in" button
4. Observe error message

### Expected Results

- User remains on `/sign-in` page
- Error toast/message is displayed indicating invalid credentials
- Form fields are not cleared (email remains, password may be cleared)

### Selectors

| Element        | Locator        | Value               |
| -------------- | -------------- | ------------------- |
| Email input    | Label          | /email/i            |
| Password input | Label          | /password/i         |
| Sign in button | Role           | button, "Sign in"   |
| Error toast    | Data attribute | [data-sonner-toast] |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should show error for invalid credentials`

---

## FLOW_AUTH_004: Redirect Unauthenticated User

### Description

Unauthenticated user attempting to access protected routes is redirected to sign-in.

### Preconditions

- User is not signed in (no valid session)

### Test Data

- None required (unauthenticated state)

### Steps

1. Attempt to navigate directly to `/home`
2. Observe redirect to `/sign-in`

### Expected Results

- User is automatically redirected to `/sign-in`
- Protected content is not visible
- After sign-in, user may be redirected back to originally requested page

### Selectors

| Element              | Locator | Value               |
| -------------------- | ------- | ------------------- |
| Sign in page heading | Role    | heading, /sign in/i |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should redirect unauthenticated user to sign-in`

---

## FLOW_AUTH_005: Sign Up with Email/Password

### Description

User creates a new account using email and password. After successful registration, they must verify their email before signing in.

### Preconditions

- User does not have an existing account with this email
- User is not currently signed in
- User is on the sign-up page

### Test Data

- **Email**: Generated unique email (e.g., `e2e-test-{timestamp}@example.com`)
- **Password**: `TestPassword123!` (meets password requirements)

### Steps

1. Navigate to `/sign-up`
2. Enter email in the email input field
3. Enter password in the password input field
4. Enter same password in the confirm password field
5. Click the "Submit" button
6. Wait for "Account created" confirmation

### Expected Results

- User sees "Account created" message
- User sees "Please check your email for verification" message
- Sign In button is visible to navigate to login page

### Selectors

| Element                | Locator | Value                       |
| ---------------------- | ------- | --------------------------- |
| Email input            | Label   | /^email$/i                  |
| Password input         | Label   | /^password$/i               |
| Confirm password input | Label   | /confirm password/i         |
| Submit button          | Role    | button, "Submit"            |
| Success heading        | Role    | heading, /account created/i |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should create account with valid credentials`

---

## FLOW_AUTH_006: Sign Up Error - Password Mismatch

### Description

User attempts to sign up with passwords that don't match and sees a validation error.

### Preconditions

- User is on the sign-up page

### Test Data

- **Email**: Any valid email
- **Password**: `Password123`
- **Confirm Password**: `DifferentPassword`

### Steps

1. Navigate to `/sign-up`
2. Enter email
3. Enter password
4. Enter different password in confirm password field
5. Click "Submit" button

### Expected Results

- User remains on `/sign-up` page
- Validation error is displayed indicating passwords don't match
- Form is not submitted

### Selectors

| Element                | Locator | Value                  |
| ---------------------- | ------- | ---------------------- | ---------------------- |
| Confirm password input | Label   | /confirm password/i    |
| Error message          | Text    | /passwords don't match | passwords must match/i |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should show error when passwords do not match`

---

## FLOW_AUTH_007: Sign Up Error - Invalid Email

### Description

User attempts to sign up with an invalid email format and sees a validation error.

### Preconditions

- User is on the sign-up page

### Test Data

- **Email**: `invalid-email` (no @ symbol)
- **Password**: `ValidPassword123`

### Steps

1. Navigate to `/sign-up`
2. Enter invalid email
3. Enter password and confirm password
4. Click "Submit" button

### Expected Results

- User remains on `/sign-up` page
- Validation error is displayed indicating invalid email format
- Form is not submitted

### Selectors

| Element       | Locator | Value          |
| ------------- | ------- | -------------- | ------------- |
| Email input   | Label   | /^email$/i     |
| Error message | Text    | /invalid email | valid email/i |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should show error for invalid email format`

---

## FLOW_AUTH_008: Navigate from Sign Up to Sign In

### Description

User on the sign-up page clicks the link to navigate to sign-in page.

### Preconditions

- User is on the sign-up page

### Test Data

- None required

### Steps

1. Navigate to `/sign-up`
2. Click "Already have an account? Sign In." link
3. Wait for navigation to `/sign-in`

### Expected Results

- User is redirected to `/sign-in` page
- Sign-in form is visible

### Selectors

| Element      | Locator | Value            |
| ------------ | ------- | ---------------- |
| Sign in link | Role    | link, /sign in/i |

### E2E Test Reference

- **File**: `e2e/specs/auth.spec.ts`
- **Test**: `should navigate to sign-in from sign-up page`
