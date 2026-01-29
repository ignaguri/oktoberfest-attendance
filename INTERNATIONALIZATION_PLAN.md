# Internationalization Implementation Plan

## Overview
Replace 75-85 hardcoded strings across web app with translation keys. Current i18n coverage is 60-70%, with comprehensive translation files already in place (1544 lines).

## Priority-Based Implementation

### Phase 1: Critical Navigation & Error Handling
**Impact**: User authentication, navigation, error states

1. **apps/web/components/navbar.tsx**
   - Hardcoded: "Sign In" button
   - Use existing key: `auth.signIn.title`

2. **apps/web/app/error.tsx (ErrorPage)**
   - Hardcoded: "Something went wrong!", "Try again" button
   - Add new keys:
     - `common.errors.somethingWentWrong`
     - `common.buttons.tryAgain`

3. **apps/web/app/not-found.tsx**
   - Hardcoded: "Not Found", "Page not found" message, "Go Home" button
   - Add new keys:
     - `common.errors.notFound`
     - `common.errors.pageNotFoundMessage`
     - `common.buttons.goHome`

### Phase 2: High-Priority User Features
**Impact**: Core functionality, sharing, privacy

4. **apps/web/components/groups/GroupMembersMap.tsx (LocationSharing)**
   - 14 hardcoded strings including:
     - "Share Location", "Stop Sharing", "Location Sharing"
     - "You can see where your group members are", etc.
   - Add new keys under `groups.location.*`:
     - `groups.location.shareLocation`
     - `groups.location.stopSharing`
     - `groups.location.title`
     - `groups.location.description`
     - `groups.location.enablePrompt`
     - `groups.location.privacyNotice`
     - `groups.location.permissions.*` (browser, denied, checking)
     - `groups.location.errors.*` (timeout, unavailable, generic)

5. **apps/web/components/InstallPWA.tsx**
   - 10+ hardcoded strings for PWA installation prompts
   - Add new keys under `pwa.*`:
     - `pwa.install.title`
     - `pwa.install.message`
     - `pwa.install.button`
     - `pwa.install.later`
     - `pwa.install.instructions.*` (ios, android, desktop)

6. **apps/web/components/ShareDialog.tsx**
   - Hardcoded: Share dialog text and buttons
   - Map to existing `groups.share.*` keys or create:
     - `common.share.title`
     - `common.share.copyLink`
     - `common.share.copied`

7. **apps/web/components/groups/MyGroups.tsx**
   - Hardcoded: Various group management strings
   - Map to existing `groups.*` keys

8. **apps/web/components/settings/LocationPrivacySettings.tsx**
   - Hardcoded: Privacy setting descriptions
   - Add keys under `settings.privacy.location.*`

### Phase 3: Medium Priority UI Components

9. **apps/web/components/ui/Breadcrumbs.tsx**
   - Hardcoded: Breadcrumb labels
   - Add keys under `navigation.breadcrumbs.*`

10. **apps/web/components/Footer.tsx**
    - Hardcoded: Footer links and copyright text
    - Add keys:
      - `footer.links.*` (privacy, terms, contact)
      - `footer.copyright`

11. **apps/web/components/attendance/TentSelector.tsx**
    - Hardcoded: Tent selection labels
    - Map to existing `attendance.tent.*` keys

12. **apps/web/components/attendance/ReservationDialog.tsx**
    - Hardcoded: Reservation form labels
    - Map to existing `reservations.*` keys

13. **apps/web/components/VersionChecker.tsx**
    - Hardcoded: Update notification text
    - Add keys:
      - `common.updates.available`
      - `common.updates.refresh`

### Phase 4: Forms & Validation

14. **apps/web/app/(private)/profile/edit/page.tsx**
    - Hardcoded: Form labels and placeholders
    - Map to existing `profile.*` keys

15. **Various form components**
    - Ensure all form validation messages use translation keys
    - Already defined in `validation.*` namespace

## New Translation Keys Required

### common namespace
```typescript
common: {
  errors: {
    somethingWentWrong: string,
    notFound: string,
    pageNotFoundMessage: string,
  },
  buttons: {
    tryAgain: string,
    goHome: string,
  },
  share: {
    title: string,
    copyLink: string,
    copied: string,
  },
  updates: {
    available: string,
    refresh: string,
  },
}
```

### groups.location namespace (new)
```typescript
groups: {
  location: {
    shareLocation: string,
    stopSharing: string,
    title: string,
    description: string,
    enablePrompt: string,
    privacyNotice: string,
    permissions: {
      requesting: string,
      denied: string,
      checking: string,
    },
    errors: {
      timeout: string,
      unavailable: string,
      generic: string,
    },
  },
}
```

### pwa namespace (new)
```typescript
pwa: {
  install: {
    title: string,
    message: string,
    button: string,
    later: string,
    instructions: {
      ios: string,
      android: string,
      desktop: string,
    },
  },
}
```

### navigation namespace (new)
```typescript
navigation: {
  breadcrumbs: {
    home: string,
    groups: string,
    profile: string,
    attendance: string,
    achievements: string,
  },
}
```

### footer namespace (new)
```typescript
footer: {
  links: {
    privacy: string,
    terms: string,
    contact: string,
  },
  copyright: string,
}
```

### settings.privacy.location namespace (new)
```typescript
settings: {
  privacy: {
    location: {
      title: string,
      description: string,
      shareWithGroups: string,
      shareWithGroupsDescription: string,
    },
  },
}
```

## Implementation Steps

1. **Add new translation keys** to all language files (en.json, de.json, es.json)
   - ~40-50 new keys total
   - Maintain hierarchical structure
   - Add German translations (es.json will remain English fallback)

2. **Update components in priority order** (Phases 1-4)
   - Import `useTranslation` hook
   - Replace hardcoded strings with `t()` calls
   - Ensure interpolation variables are preserved
   - Test each component after changes

3. **Verify translations**
   - Switch between languages to verify all strings render correctly
   - Check for missing keys (should show key path if missing)
   - Verify German translations make cultural sense

4. **Update tests** (if any component tests exist)
   - Mock i18n context
   - Update snapshots if needed

## Files to Modify

### Translation Files (3 files)
- packages/shared/src/i18n/locales/en.json
- packages/shared/src/i18n/locales/de.json
- packages/shared/src/i18n/locales/es.json

### Web Components (13-15 files)
- apps/web/components/navbar.tsx
- apps/web/app/error.tsx
- apps/web/app/not-found.tsx
- apps/web/components/groups/GroupMembersMap.tsx
- apps/web/components/InstallPWA.tsx
- apps/web/components/ShareDialog.tsx
- apps/web/components/groups/MyGroups.tsx
- apps/web/components/settings/LocationPrivacySettings.tsx
- apps/web/components/ui/Breadcrumbs.tsx
- apps/web/components/Footer.tsx
- apps/web/components/attendance/TentSelector.tsx
- apps/web/components/attendance/ReservationDialog.tsx
- apps/web/components/VersionChecker.tsx
- apps/web/app/(private)/profile/edit/page.tsx
- (Additional form components as needed)

## Estimated Effort
- Phase 1: 30 minutes (3 files, ~6 keys)
- Phase 2: 1.5 hours (6 files, ~35 keys)
- Phase 3: 45 minutes (5 files, ~15 keys)
- Phase 4: 30 minutes (2-4 files, using existing keys)
- **Total: ~3-4 hours**

## Success Criteria
- Zero hardcoded user-facing strings in web components
- All new keys translated to German
- Language switcher works seamlessly across all pages
- No broken UI or missing translations
- Type-safe translation keys (no runtime errors)
