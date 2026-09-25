# Store screenshots

Raw simulator captures live in `screenshots/iphone-6.9/raw/`, framed store-ready
versions (1320x2868, App Store 6.9") in `screenshots/iphone-6.9/framed/<locale>/`.
The raw files are kept on purpose: re-framing or re-wording never needs a re-shoot.

## Re-framing

```bash
python3 scripts/store-screenshots/render.py en
```

Headlines come from `copy.json`, keyed by the raw file name. Adding a locale is
adding a block there (German with real umlauts, Spanish in voseo) and running the
script with that locale. Needs Pillow and Google Chrome; fonts are in `fonts/` (OFL).

## Re-shooting

1. Local Supabase running, then `scripts/store-screenshots/seed-demo.sh`. It creates
   `demo.*@example.com` (password `password`) mid-Oktoberfest, additively: it never
   resets the DB and only touches the demo users. Unlocks come from the real
   `AchievementService`, so progress and badges match the data.
2. Capture immediately. The feed only shows the last 48h and the home crowd card
   roughly the last 30 minutes, so the data goes stale within the hour.
3. `pnpm dev:web` (API on 3008) and Metro from this worktree; check that nobody
   else's server holds 8081/3008. Boot the iPhone 17 Pro Max simulator, then
   `xcrun simctl status_bar <udid> override --time 9:41 --batteryState discharging --batteryLevel 100`.
4. Sign in as `demo.sophie@example.com`. Shot order matters for one screen:
   capture Home first, then run `seed/demo-tent-picker-crowd.sql` and capture the
   tent picker (with those extra reports Home gets too busy).
5. Wrapped needs the festival switched to Oktoberfest 2025 (Profile, Select Festival).
   The map needs location allowed, `xcrun simctl location <udid> set 48.1318,11.5497`,
   and "Share" tapped so the nearby-friends query runs.
