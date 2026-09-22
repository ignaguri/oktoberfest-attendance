# Pomelli (Google Labs) — Brand DNA & Campaigns

[Pomelli](https://labs.google.com/u/1/pomelli/review) is a Google Labs tool that generates
marketing campaigns, social graphics, product photoshoots, and websites from a "Business DNA"
profile (colors, fonts, tagline, brand values/aesthetic/tone, business overview). It's signed in
with a personal Google account, not a Holidu one.

It auto-scraped ProstCounter's Business DNA from prostcounter.fun, but the scrape got the
neutrals and font wrong. The profile has since been corrected against the actual codebase and is
now 100% complete and ready to use for campaign/creative generation — no more setup needed, just
open the tool and start prompting.

## Current Business DNA config

**Colors** (chat with the Pomelli Agent to change; it consults a "Design specialist" sub-agent):

| Hex       | Tailwind token | Role     | Grounding                                                         |
| --------- | --------------- | -------- | ------------------------------------------------------------------ |
| `#facc15` | yellow-400      | Primary  | Real: `--color-brand` in `apps/web/styles/globals.css:51`, used 95+ times |
| `#f97316` | orange-500      | Accent   | Real: achievement badge "drinking" category color, `packages/shared/src/achievements/badge-tokens.ts:8` |
| `#7f1d1d` | red-900         | Accent   | Real: form input-error text color, `apps/web/styles/globals.css:241` |
| `#431407` | orange-950      | Accent   | Not used in-app yet; deep end of the same orange-500 scale above, kept for a coherent ramp |
| `#fefce8` | yellow-50       | Neutral  | Not used in-app yet; same family as the real brand yellow |

Pomelli's initial scrape had `#eab308` (wrong shade of yellow) plus generic shadcn UI neutrals
(`#ffffff` / `#111827` / `#f8fafc`) that read as "white, grey, near-black" — no festive character.
The agent's first fix invented an unrelated warm palette; the table above is the corrected,
grounded version (same shades, real/coherent hex values).

**Fonts**: Calistoga (display/headlines) + Inter (body) — chosen for campaign typography to pair
Bavarian beer-hall charm with clean readability. Note: the app itself doesn't load a custom web
font (no `next/font`/`@font-face` in the codebase), so this pairing is Pomelli-only, not a claim
about the real site.

**Tagline**: "Track your beer festival attendance and compete with friends." (matches
`apps/web/app/layout.tsx:32,35` exactly)

**Brand values**: Community, Fun, Convenience

**Brand aesthetic**: Golden Amber Warmth, Playful 3D Whimsy, Clean Utility UI, Bavarian Festive
Charm, Friendly Digital Minimal

**Brand tone of voice**: Friendly, Informative, Casual, Lively

**Business overview**: "The ultimate beer festival companion app for tracking drinks, locating
friends in real time, and competing on group leaderboards at Oktoberfest and beyond." — covers
drink logging, tent check-ins (`apps/mobile/lib/database/tent-visits.ts`), real-time location
sharing (`apps/web/app/api/location-sharing/`), group leaderboards, and the watchOS target
(`apps/mobile/targets/watch/`).

## What's already built

- **Campaigns → "Track Every Prost This Oktoberfest"**: 5 social graphics generated (tent
  check-ins, live leaderboard, crew tracking, cross-platform/Apple Watch callout).

## Usage notes

- Revisions go through the **Pomelli Agent** chat panel (Business DNA page) — describe what's
  wrong and why, it proposes a fix and either applies it directly or asks for confirmation.
- Not yet explored: **Photoshoot** (product photos) and **Websites** tabs.
- Pomelli can invent plausible-sounding but fake brand facts (e.g. "Roboto" font, arbitrary hex
  colors) — always sanity-check its scraped/suggested Business DNA against the actual codebase
  before accepting it, the same way the color/font corrections above were done.
