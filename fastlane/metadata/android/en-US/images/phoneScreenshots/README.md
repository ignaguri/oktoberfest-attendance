# Phone screenshots — en-US

Drop final PNGs in this directory. Files are picked up in lexical order, so the numeric prefix controls Play Console display order.

## Specs

- Format: PNG (preferred) or JPEG
- Aspect ratio: 9:16 portrait (or 16:9 landscape)
- Size: 1080×1920 px (9:16 portrait) is the safe target — Play Console accepts up to 7680 px on the long edge
- Min: 2 screenshots, Max: 8

## Naming convention

```
01_home.png
02_log_attendance.png
03_tents.png
04_group_leaderboard.png
05_profile.png
06_wrapped.png
07_map.png
08_friends.png
```

## Suggested shot list (priority order)

1. **Home / log attendance** — the screen most users land on. Show the date selector, drink counters, "Save" CTA.
2. **Tent picker** — show the visual list with tent images.
3. **Group leaderboard** — leaderboards are the social hook; pick a group with friends and visible avatars.
4. **Profile / achievements** — show a few unlocked badges.
5. **Wrapped** — the most visually striking screen; pick a colorful slide.
6. **Map** — Theresienwiese view with tent pins.
7. **Friends list** — proof that friendship features exist.

## Capturing

1. Build a `production-apk` build (`eas build --profile production-apk --platform android`).
2. Install on a Pixel 6+ emulator (1080×2400 native — close enough; downscale if needed).
3. Seed realistic data (use the `user1@example.com … user10@example.com` accounts, password `password` — see `apps/web/seed-data/`).
4. `adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png` per shot.

## Text overlays

The tester feedback recommends short overlays (e.g. "Track your beer history!"). Add overlays in Figma or a similar tool, export as PNG, commit the final composite. Keep typography consistent across all 8 shots.
