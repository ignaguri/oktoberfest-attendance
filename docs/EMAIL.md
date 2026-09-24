# Email: Domains, Senders and Rules

Where ProstCounter's email comes from, which domain is used for what, and the
rules that keep auth mail deliverable. Last reviewed 2026-09-14.

## Provider

Everything goes through **Resend** (free plan, region `eu-west-1`). DNS for
`prostcounter.fun` lives in **Vercel** (`ns1/ns2.vercel-dns.com`, team
`ignacio-guris-projects`).

Free plan limits, all shared across the whole account:

- 3 sending domains (2 in use)
- 100 emails/day, 3,000/month. Resend **pauses** rather than queues once the
  daily cap is hit, so broadcasts over 100 recipients must be split into
  batches on separate days.

## Sending Domains

| Domain | Used for | Open tracking | Click tracking |
|---|---|---|---|
| `account.prostcounter.fun` | Supabase Auth only (confirm signup, password reset, magic links) | off | off |
| `notify.prostcounter.fun` | Bulletins and marketing broadcasts | off | **on**, via `links.notify.prostcounter.fun` |

The split keeps sender reputation separate: unsubscribes and spam complaints on
a bulletin cannot hurt password-reset delivery.

## Addresses

| Address | Where it is configured | Purpose |
|---|---|---|
| `team@account.prostcounter.fun` ("ProstCounter") | Supabase Auth SMTP settings (`smtp_admin_email`, host `smtp.resend.com`) | All auth mail |
| `ignacio@account.prostcounter.fun` | Resend broadcast | August 2026 bulletin only. Legacy, do not reuse |
| `hello@notify.prostcounter.fun` (suggested) | Resend broadcast | Future bulletins and marketing |
| `feedback@notify.prostcounter.fun` ("ProstCounter Feedback") | `packages/api/src/lib/feedback-email.ts` | In-app feedback notifications to the admin inbox (`FEEDBACK_NOTIFY_EMAIL`), Reply-To set to the user |

Any local part works on a verified domain, so a new address like
`no-reply@notify.prostcounter.fun` needs no DNS or Resend change.

## What Does Not Send Email

- **Novu** sends no email. Every workflow is in-app plus push only, and its
  only email integration is Novu's unused built-in demo provider. If a workflow
  ever gets an email step, add a Resend integration in Novu and send from
  `notify.`, never `account.`.
- The app code makes one direct Resend call: the feedback notification in
  `packages/api/src/lib/feedback-email.ts` (REST API, `RESEND_API_KEY`, plain
  text, from `notify.`). Auth mail is sent by Supabase over SMTP, broadcasts are
  sent from the Resend dashboard or MCP.

## Rules

- **Never enable tracking on `account.`.** Click tracking rewrites links, and a
  mail scanner following the rewritten link can consume a one-time
  password-reset or confirmation token before the user does.
- **Pick the sender by mail type**: auth on `account.`, anything
  promotional on `notify.`.
- **Resend needs a tracking subdomain before tracking works.** Without one,
  `click_tracking` / `open_tracking` updates return success but the flags stay
  `false`. Once set, a tracking subdomain can be renamed but never removed.
- **Auth mail is rate limited on the Supabase side** too: `smtp_max_frequency`
  is 60s per address. See [CAPTCHA_ROLLOUT.md](./CAPTCHA_ROLLOUT.md) for why.

## DNS Records

All records are managed in Vercel DNS. Values come from Resend's domain page;
names are relative to `prostcounter.fun`.

| Name | Type | For |
|---|---|---|
| `resend._domainkey.account` | TXT | DKIM, `account.` |
| `send.account` | MX + TXT | Return-Path and SPF, `account.` |
| `resend._domainkey.notify` | TXT | DKIM, `notify.` |
| `send.notify` | MX + TXT | Return-Path and SPF, `notify.` |
| `rsend.notify` | CNAME | Resend sending, `notify.` |
| `links.notify` | CNAME | Click tracking, `notify.` |
| `@` | CAA `0 issue "amazon.com"` | Lets Resend issue the tracking TLS cert. Vercel's default CAA issuers stay in place |
| `_dmarc` | TXT `v=DMARC1; p=none;` | DMARC for the root and all subdomains |

### Adding a Record

```bash
vercel dns add prostcounter.fun <name> <TYPE> <value> [mx-priority]
```

Then trigger verification in Resend and wait a couple of minutes. If the CLI
fails with `fetch failed` inside an IDE that sets a local HTTPS proxy, run it
with the proxy env unset: `env -u HTTPS_PROXY -u https_proxy -u NODE_EXTRA_CA_CERTS vercel ...`.

## Known Gaps

- **No domain receives mail.** There are no MX records on `prostcounter.fun`,
  `account.` or `notify.` (the `send.*` MX records only handle bounce
  feedback), so replies to any sender bounce. Resend receiving or a forwarding
  service would fix this. For that reason no public contact points at a
  mailbox: `security.txt` (`apps/web/app/api/security.txt/route.ts`) sends
  reporters to GitHub private vulnerability reporting instead. Its `Expires`
  is 2027-09-01 and needs bumping before then.

## Related

- [docs/email/2026-08-bulletin.html](./email/2026-08-bulletin.html): last
  bulletin as sent, template tokens and broadcast gotchas
- [CAPTCHA_ROLLOUT.md](./CAPTCHA_ROLLOUT.md): the 2026-09-08 email relay abuse
  and auth-log monitoring
