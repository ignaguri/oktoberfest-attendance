# Oktoberfest 2026 data + bulletin email tracking

**Date:** 2026-08-04
**Status:** Approved design

## Goal

Send a one-off "what's new" bulletin to 139 existing/lapsed users, and be able to measure
whether it worked. Two prerequisites turned out to be blocking, and they are the bulk of this
spec:

1. Oktoberfest 2026 does not exist in the database, and the currently active festival is a
   festival that ended in May 2026. Anyone who follows the email into the app today lands on a
   finished Frühlingsfest.
2. Tent coordinates in production are fabricated. The email's headline feature after the native
   apps is "see who's nearby on a map", so shipping the email before fixing coordinates would
   drive users at a map that is wrong by up to ~900 m.

The email itself is already written, approved, and sitting in two draft Resend broadcasts. What
is missing is tracking.

## Non-goals

- No marketing-consent or email-preference UI. This send remains a one-time legitimate-interest
  service update with a working unsubscribe link. If recurring email becomes a thing, real opt-in
  gets built first.
- No routing email through Novu. Novu keeps handling push and in-app only. Revisit only if
  recurring automated email tied to Novu's subscriber/preference infrastructure is wanted.
- No new redirect slugs under `/r/`. Resend click tracking already yields per-link counts, and an
  extra JS interstitial between an email tap and the App Store only loses people.
- No custom Resend tracking subdomain (branded click links). Extra DNS plus re-verification risk
  for a marginal deliverability gain at 139 recipients.
- No changes to how the app picks the active festival. The existing `is_active` lookup is fine.

## Established facts

Verified during design; the implementation depends on these.

### Festival

- Oktoberfest 2026 is the 191st Wiesn: **19 September to 4 October 2026** (16 days).
- Maß prices run **EUR 14.80 to 15.90**. Most large tents are EUR 15.80. Armbrustschützen,
  Bräurosl and Löwenbräu are EUR 15.90. Augustiner is EUR 14.90. Museumszelt is EUR 14.80, the
  cheapest on the grounds.
- Festival base price is therefore **EUR 15.80 / 1580 cents**, the modal large-tent price.
- The Oide Wiesn runs in 2026 (the Zentral-Landwirtschaftsfest that displaces it is not due until
  2028).

### Schema constraints

- `CREATE UNIQUE INDEX idx_festivals_single_active ON festivals (is_active) WHERE is_active = true`.
  Only one festival can be active. The currently active row must be deactivated in the same
  transaction as the insert, or the insert raises a unique violation.
- `festivals.short_name` is unique. Convention from prior rows: `oktoberfest-2026`.
- `festivals.status` is an enum: `upcoming | active | ended`.
- `tents` is shared across festivals and carries `latitude`, `longitude` and a PostGIS `location`
  column. `festival_tents` links tents to a festival and holds `beer_price` / `beer_price_cents`.
- `drink_type_prices` holds either a `festival_id` (festival-level default) or a
  `festival_tent_id` (per-tent override).

### Existing data problems

- **Fabricated coordinates.** Sorted by position, every tent falls on an evenly spaced diagonal
  line across Theresienwiese. Spot-checked against OSM: Marstall-Festzelt is off by ~900 m,
  Museumzelt by ~650 m, Hofbräu-Festzelt by ~235 m.
- **Incomplete 2025 lineup.** Only 27 tents were linked to `oktoberfest-2025`, while 13 further
  real Oktoberfest venues already exist in `tents` with coordinates and were never linked:
  Café Theres', Fisch-Bäda, Goldener Hahn, Heimer, Heinz, Hochreiters Haxnbraterei, Münchner
  Knödelei, Schiebl's Kaffeehaferl, Vinzenzmurr Metzger Stubn, Wiesn Guglhupf, Wirtshaus im
  Schichtl, plus Oide Wiesn's Boandlkramerei and Volkssängerzelt Schützenlisl.
- **Typo.** `Museumzelt` should be `Museumszelt`.
- **Name drift** from official 2026 naming, e.g. `Paulaner Festzelt` vs `Winzerer Fähndl`,
  `Pschorr-Festzelt Bräurosl` vs `Bräurosl`, `Armbrustschützen Festzelt` vs `Armbrustschützenzelt`.
- **Stale Oide Wiesn set.** The 2025 `old` tents include `Herzkasperlzelt` and
  `Zur Schönheitskönigin`, which do not match the 2026 lineup.

### 2026 lineup changes

- **Bartls Flößerstadl** is new, a small tent (398 seats) that **replaces Münchner Stubn at the
  same location**, so it inherits Münchner Stubn's position.
- **Hühner und Entenbraterei Poschner** is in the official small-tent list but absent from `tents`
  entirely.
- One price source lists Flößerstadl among the large tents. That is wrong; it is small. This is
  the concrete reason the data table gets human review before any write.

### Resend / sending

- Domain `account.prostcounter.fun` is verified, has **open tracking and click tracking both off**,
  and also sends Supabase Auth transactional email. Tracking is a per-domain setting, so enabling
  click tracking there would rewrite links inside password-reset and confirm-signup emails. A mail
  scanner prefetching a rewritten one-time link is a realistic way to break a reset.
- DNS for `prostcounter.fun` is on Vercel (`ns1/ns2.vercel-dns.com`, scope
  `ignacio-guris-projects`). The Vercel MCP has no DNS tooling, but the Vercel CLI is installed and
  authenticated, so records go in via `vercel dns add`.
- Web analytics is **GA4** via `@next/third-parties/google`, production only. `utm_*` params on
  `prostcounter.fun` links are captured automatically with no code change.
- Nothing in CI applies migrations. Production is reached with `pnpm sup:db:push`.

## Revision, 2026-08-04: sections 2 and 5 partly void

Section 2 (split the sending domain) could not be built. Resend's free plan permits exactly one
custom domain and `account.prostcounter.fun` holds the slot, so creating `news.prostcounter.fun`
returns `403 "Your plan includes 1 domain. Upgrade to add more."`

Three routes were weighed: Resend Pro at 20 USD/month, a separate provider for marketing mail, or
dropping click tracking. On the provider option, Brevo, Kit, EmailOctopus and MailerLite were all
checked and every free tier stamps its own branding onto the email, which is a poor fit for a
customer-facing product announcement; the paid tiers cost about the same as Resend Pro while also
requiring a full re-setup and leaving the stack split across two dashboards.

The decision was to stay free and drop click tracking. Consequences:

- No `news.prostcounter.fun`. The sender remains `ignacio@account.prostcounter.fun`, which is what the
  two approved test sends already used. Resend open and click tracking stay off everywhere.
- Section 5's "per-link clicks and opens: Resend broadcast detail" no longer holds. Resend reports
  delivery, bounces and complaints only.
- The two-batch send stays: the 100-per-day cap is a plan limit independent of domains.
- The transactional/marketing reputation split described in section 2 is not achieved. Acceptable for
  a one-off send to an opted-in-by-signup list, but it is a real reason to revisit if recurring
  bulletins ever happen.
- The store-side parameters in section 3 become the only per-channel signal, which makes the Apple
  provider token more valuable, not less.

Sections 1, 3, 4 and 6 are unaffected.

## Design

### 1. Oktoberfest 2026 data

**Sourcing rule:** coordinates come from OpenStreetMap via the Overpass API (ODbL), not from the
existing rows and not from guesswork. Tent lineup and prices come from the published 2026 sources.
Anything that cannot be verified is flagged rather than invented.

OSM does not cover `Wiesn Guglhupf`, `Zur Schönheitskönigin`, or `Bartls Flößerstadl` (not yet
mapped). Flößerstadl takes Münchner Stubn's OSM position. The other two are placed manually from
the official festival map, or left out if they are not part of the 2026 lineup.

OSM also contains near-duplicate names (`Haxenbraterei` and `Haxnbraterei`, `Café Kaiserschmarrn`
and `Rischart's Café Kaiserschmarrn`). The name-to-tent mapping is therefore a reviewed pass, never
a blind join.

**Review gate:** the research produces a reference table of one row per tent with name, category,
Maß price, latitude, longitude, source, and a verified/unverified marker. That table is approved
before a single row is written to production. A wrong price is visible to every user and corrupts
their spend statistics, so this gate is not optional.

**Migration** `supabase/migrations/<timestamp>_add_oktoberfest_2026.sql`, following the structure of
`20260409174404_add_fruehlingsfest_2026.sql`:

1. Deactivate the currently active festival (`UPDATE festivals SET is_active = false WHERE is_active = true`).
   Must precede the insert because of `idx_festivals_single_active`.
2. Insert `Bartls Flößerstadl` and `Hühner und Entenbraterei Poschner` into `tents`.
3. Correct coordinates on existing tents. Scope: every tent in the approved 2026 lineup. Tents that
   belong only to other festivals (Augustinerkeller, Löwenbräukeller, Paulaner am Nockherberg,
   Festhalle Bayernland, Hippodrom, Ayinger Braustuberl, Giesinger Bräu) are left alone; they have
   null coordinates today and fixing them is separate work. Also fix `Museumzelt` to `Museumszelt`
   and align the remaining names with official 2026 naming.
4. Insert the `oktoberfest-2026` festival: 19 Sep to 4 Oct 2026, `status: 'upcoming'`,
   `is_active: true`, base EUR 15.80 / 1580 cents, Theresienwiese coordinates, `map_url` and
   description.
5. Link every tent in the approved 2026 lineup via `festival_tents` with its per-tent price.
6. Insert festival-level `drink_type_prices` from the 1580-cent base, using the same per-drink
   ratios as the Frühlingsfest migration: `beer` and `radler` and `other` at the base,
   `alcohol_free` at 0.90, `wine` at 0.85, `soft_drink` at 0.40. Then per-tent overrides
   (`beer` and `radler`) wherever a tent's price differs from the base.

The migration is idempotent where the precedent allows it (`ON CONFLICT (id) DO NOTHING` on tent
inserts) so a partial failure can be retried.

**Renaming existing tents** changes only display names and positions. `tent_visits` references tent
ids, so historical data stays valid. The side effect is that last year's map becomes retroactively
correct rather than staying consistent with what users saw at the time. Accepted deliberately.

**Verification:** apply to local, then a full `pnpm sup:db:reset` to prove the whole migration chain,
then `pnpm sup:db:push` to production. Confirm afterwards that exactly one festival is active, that
it is `oktoberfest-2026`, and that every linked tent has a price and non-null coordinates.

### 2. Split the sending domain

New Resend domain **`news.prostcounter.fun`**, region `eu-west-1` to match the existing one, with
`openTracking` and `clickTracking` both enabled **on that domain only**. `account.prostcounter.fun`
keeps both off, so Supabase Auth links are never rewritten.

DKIM, SPF and MX records are added with `vercel dns add` and then verified in Resend. The broadcast
`from` becomes `Ignacio from ProstCounter <ignacio@news.prostcounter.fun>`.

This also buys the standard transactional/marketing reputation split: unsubscribes and complaints
from bulletins stop counting against the domain that has to deliver password resets.

Risk: a fresh subdomain has no sending reputation. At 139 emails to people who signed up
themselves this is negligible, and `_dmarc` is `p=none` so there are no alignment failures. SPF and
DKIM must both read verified before sending.

Contacts and segments are account-level in Resend and carry over untouched.

### 3. Link parameters

Convention: `utm_source=email`, `utm_medium=bulletin`, `utm_campaign=aug2026-whatsnew`,
`utm_content=<web|app-store|play-store>`.

- **Web** gets plain UTMs on `prostcounter.fun`. GA4 captures them automatically.
- **Google Play** carries the UTMs inside a URL-encoded `referrer` param, which surfaces in Play
  Console acquisition reports.
- **Apple** uses the link App Store Connect generates for a campaign named `aug2026-whatsnew`,
  carrying `pt`, `ct` and `mt=8`. The `pt` provider token only exists inside App Store Connect, so
  it is produced by driving the already-authenticated Chrome session to App Analytics, Acquisition,
  Campaigns.

Parameters go into the plain-text body as well as the HTML, so text-only readers are still
attributed.

Resend's click tracking rewrites each href and then redirects to the full original URL, query string
intact, so store-side attribution survives the rewrite.

### 4. Version-control the email

The bulletin HTML currently exists only inside Resend. A copy is committed to the repo as a
reference so a future bulletin starts from an edit rather than a rebuild. Resend stays the source of
truth for what actually ships; the repo copy is explicitly a snapshot, noted as such in the file, to
keep the drift risk honest.

### 5. Where results are read

- Per-link clicks and opens: Resend broadcast detail.
- Web sessions and downstream behaviour: GA4, Traffic acquisition, filtered to `email / bulletin`.
- Android installs: Play Console acquisition reports, filtered by `utm_campaign`.
- iOS installs: App Store Connect, App Analytics, Campaigns.

### 6. Sending

One test send to `ignacioguri@gmail.com` from the new domain, confirming: renders as before, header
icon loads, Resend's rewritten links still reach the right destinations with parameters intact, and
unsubscribe works.

Then Batch 1 (96 recipients), then Batch 2 (43 recipients) scheduled roughly 26 hours later. The
gap exists because the Resend free tier caps at 100 emails per day and **pauses** rather than
queueing once the cap is hit.

After both, verify delivery health (no mass bounces or complaints) before calling it done.

## Sequencing

Phase 0 must complete before Phase 3. The email tells people to come back and look, so the festival
has to be live and the map has to be correct before anyone clicks. Phases 1 and 2 are independent of
Phase 0 and can proceed in parallel with it.

## Open items

- Exact Maß prices for several small tents are published only as "under EUR 15" and need pinning
  down, or flagging as unverified in the reference table.
- Whether `Zur Schönheitskönigin` and `Wiesn Guglhupf` are part of the 2026 lineup at all.
- Confirmation that logging a drink against an `upcoming` festival behaves sensibly in the UI, given
  the festival goes active six weeks before it starts.

## Existing state, for reference

- Resend segments: General (`2c3159c7-ccfc-4b5b-9be3-b73522702336`), Bulletin Aug 2026 Batch 1
  (`ab9269de-d777-42e3-a22e-3c67fe0d589b`, 96 contacts), Batch 2
  (`e998142d-d562-4a5a-8778-8a582253ec20`, 43 contacts).
- Draft broadcasts: Batch 1 `d193c030-d7a4-4ff9-b42c-93dc3bdf2940`, Batch 2
  `455968b3-3358-46fa-95c6-bc01fe2dae87`.
- Recipients were derived from `auth.users` where `email_confirmed_at is not null` (158 confirmed of
  377 registered), then filtered to 139 by removing store review bots, Apple private relay
  addresses, test and placeholder accounts, a disposable-domain address, and several unrelated
  corporate domains that looked like bot signups.

## Sources

- <https://www.oktoberfest.de/en>
- <https://www.munichtourism.org/oktoberfest-dates-schedule/>
- <https://wiesnkini.de/zelte/bierpreis/>
- <https://www.oktoberfest.de/en/beer-tents/small-tents>
- <https://www.falstaff.com/de/news/neuer-wiesn-wirt-floesserstadl-ersetzt-muenchner-stubn-auf-dem-oktoberfest>
- <https://www.muenchen.de/veranstaltungen/wiesn-kleine-zelte/bartls-floesserstadl>
- OpenStreetMap via the Overpass API, ODbL
