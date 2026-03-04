# Web Crowd Reporting Design

## Problem

Web users can view crowd status data on the home page but have no way to submit crowd reports. All crowd data comes exclusively from mobile users, creating a data gap.

## Design

Two new components in `apps/web/components/crowd/`:

### CrowdStatusCard

A card on the home page showing current crowd levels across tents, with a "Report Crowd Level" button at the bottom.

- Uses `useTentCrowdStatus(festivalId)` shared hook
- Shows tents with recent reports sorted by crowd level (emptiest first)
- Each tent row: tent name + colored CrowdLevelBadge (green/yellow/orange/red)
- Max 5 tents shown, "+N more" link if overflow
- "Report Crowd Level" button opens CrowdReportDialog
- Shows empty state message with "Report Crowd Level" button when no reports exist
- Only shown during active festivals

### CrowdReportDialog

A shadcn Dialog for submitting a crowd report.

- **Tent selector**: SingleSelect dropdown using `useTents(festivalId)` — single tent selection
- **Crowd level picker**: 4 radio-style buttons (Empty/Moderate/Crowded/Full) with colored dots, matching mobile's design
- **Wait time**: Optional chip-style selector with predefined options (0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180 min)
- **Rate-limit notice**: If user reported for this tent < 5 min ago, show warning using `useTentCrowdReports()`
- **Submit**: Calls `useSubmitCrowdReport()`, shows toast on success, closes dialog
- **Error handling**: Rate-limit error shown inline; generic errors shown via toast

### Placement on Home Page

The CrowdStatusCard sits between the NewsFeed and the Highlights section:

```
QuickAttendanceWrapper
NewsFeed
CrowdStatusCard  <-- new
Highlights / LeaderboardPreview / AchievementHighlight
```

## Data Flow

All hooks and APIs already exist:
- `useTentCrowdStatus(festivalId)` — aggregated tent crowd levels
- `useTentCrowdReports(tentId, festivalId)` — individual reports (for rate-limit check)
- `useSubmitCrowdReport()` — submit mutation (auto-invalidates queries)
- `useTents(festivalId)` — tent list for selector
- i18n keys under `crowdReport.*` — all present in en/de/es

## Files

| Action | File |
|--------|------|
| Create | `apps/web/components/crowd/CrowdStatusCard.tsx` |
| Create | `apps/web/components/crowd/CrowdReportDialog.tsx` |
| Modify | `apps/web/app/(private)/home/page.tsx` — add CrowdStatusCard |

No new API endpoints, hooks, schemas, or i18n keys needed.
