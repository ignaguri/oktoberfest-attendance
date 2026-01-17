# Firebase Setup for Push Notifications

The mobile app requires Firebase configuration files for push notifications to work. These files are **not tracked in git** for security reasons.

## Required Files

1. **`google-services.json`** (Android)
2. **`GoogleService-Info.plist`** (iOS)

## How to Obtain These Files

### 1. Access Firebase Console

Go to [Firebase Console](https://console.firebase.google.com/) and select the **prostcounter** project.

### 2. Download Android Config

1. Go to **Project Settings** (gear icon)
2. Select the **Android app** (`com.prostcounter.app`)
3. Click **Download google-services.json**
4. Place it in `apps/mobile/google-services.json`

### 3. Download iOS Config

1. Go to **Project Settings** (gear icon)
2. Select the **iOS app** (`com.prostcounter.app`)
3. Click **Download GoogleService-Info.plist**
4. Place it in `apps/mobile/GoogleService-Info.plist`

## File Locations

```
apps/mobile/
├── google-services.json        # Android config
└── GoogleService-Info.plist    # iOS config
```

## Security Note

These files contain **client API keys** that are safe to embed in mobile apps (they're restricted by bundle ID), but we keep them out of git as a security best practice. The API keys have restrictions configured in Firebase Console to only work with the specified app bundle IDs.

## Verification

After adding the files, you can verify they're ignored by git:

```bash
cd apps/mobile
git status  # Should not show these files
```

Both files should be listed in `.gitignore` and will not appear in git status.
