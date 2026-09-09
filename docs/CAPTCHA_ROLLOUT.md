# Captcha Rollout and Auth Abuse Monitoring

Runbook for enabling hCaptcha on the Supabase project, and the log queries that
tell you whether it is working or whether it is locking real users out.

**Status: enabled**, 2026-09-09. `security_captcha_enabled` is `true` in
production. Kept below as reference for the next incident, or if it ever needs
to be turned off and back on.

## Background

On 2026-09-08 the project was used as an email relay. A botnet signed real
third-party addresses up to ProstCounter and immediately requested password
resets, so the victims' inboxes filled with mail from our domain. 22 fake
signups produced 82 emails in one day against a normal baseline of roughly one
signup per day, which tripped Resend's daily sending limit.

Notable: the traffic came from ~25 distinct IPs, so per-IP rate limiting does
not address it. Captcha does.

Two mitigations, in order of when they landed:

1. `smtp_max_frequency` raised from 1s to 60s (2026-09-08). The attacker's
   script fires a confirmation plus three resets inside ~30s, so this alone cuts
   each victim from 4 emails to 1. It is Supabase's own default.
2. hCaptcha enabled (2026-09-09). See below.

## Before Enabling Captcha

Captcha fails closed. Every client that does not send a token is rejected, so
all of these must be true first, or you lock out sign-in, sign-up and password
recovery for everyone:

- [x] `NEXT_PUBLIC_HCAPTCHA_SITEKEY` set in Vercel production, live via PR #298's
      merge to main (2026-09-09). Verified by signing in through prostcounter.fun
      and seeing the widget solve.
- [x] `security_captcha_secret` set on the Supabase project (2026-09-09).
- [x] Mobile builds in users' hands are 1.6.2 or newer. Both 1.6.2 builds and
      Android 1.7.0 were built from commit `41d7e3a7`, which added the sitekey,
      so they are fine. Anything 1.6.0 or older sends no token.

Note that captcha only gates `/signup`, `/token` (password grant) and
`/recover`. It does not gate token refresh, so users with a live session are
unaffected. Only people who re-authenticate are exposed.

## Enabling It

There is no MCP tool for auth config, and `supabase-remote` is pinned
`--read-only`. Use the Management API with the token from `.mcp.json`
(gitignored, not in the public repo):

```bash
TOKEN=$(python3 -c "import json;print(json.load(open('.mcp.json'))['mcpServers']['supabase-remote']['env']['SUPABASE_ACCESS_TOKEN'])")
REF=jdmhjakxhtghsbnstyou

# Read current state
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.supabase.com/v1/projects/$REF/config/auth | python3 -m json.tool

# Enable
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"security_captcha_enabled": true, "security_captcha_provider": "hcaptcha", "security_captcha_secret": "<secret>"}' \
  https://api.supabase.com/v1/projects/$REF/config/auth
```

**Rollback** is the same call with `{"security_captcha_enabled": false}`. It
takes effect immediately, so this is cheap to undo.

## Monitoring Queries

Run these through the `supabase-remote` MCP `query_logs` tool, or paste the SQL
into the Logs Explorer. The window is capped at 24 hours.

### Captcha rejections

The one that matters after flipping. Anything here is a client that sent no
token or a bad one.

```sql
select
  toStartOfHour(timestamp) as hour,
  log_attributes['path'] as path,
  log_attributes['error_code'] as error_code,
  log_attributes['status'] as status,
  count(*) as n
from logs
where source = 'auth_logs'
  and (lower(log_attributes['error_code']) like '%captcha%'
    or lower(log_attributes['error']) like '%captcha%'
    or lower(log_attributes['msg']) like '%captcha%')
group by hour, path, error_code, status
order by hour desc
```

Baseline on 2026-09-08, captcha off: **zero rows**. Re-checked in the 30
minutes after enabling on 2026-09-09: still zero, alongside normal `/token`
traffic returning 200, so the flip did not break real sign-ins.

A steady trickle here going forward means real users on old builds are being
blocked, not just bots. Cross-check the volume against the abuse baseline below:
bot traffic was ~150 auth requests per day, so anything far below that is
probably legitimate users and is a reason to reconsider.

### Auth endpoint volume and spread

Shows whether the abuse is still running and how distributed it is.

```sql
select
  log_attributes['path'] as path,
  log_attributes['status'] as status,
  count(*) as n,
  uniqExact(log_attributes['remote_addr']) as distinct_ips
from logs
where source = 'auth_logs'
  and log_attributes['path'] in ('/signup', '/recover', '/token', '/verify')
group by path, status
order by n desc
```

Baseline on 2026-09-08, 24h window, captcha off and `smtp_max_frequency` already
at 60s:

| path | status | n | distinct IPs |
|---|---|---|---|
| `/token` | 400 | 69 | 25 |
| `/recover` | 200 | 62 | 22 |
| `/signup` | 200 | 23 | 21 |

The 69 failed `/token` calls are `invalid_credentials`, i.e. password guessing
against the accounts that were just created.

Once `smtp_max_frequency` is doing its job you should see `/recover` start
returning 429 instead of 200 for the rapid repeats.

### Fake account cleanup

Done on 2026-09-09: 23 unconfirmed accounts from the attack window deleted.
One address in the same window had confirmed and signed in, so it's a real
person, not part of the attack, and was kept.

Unconfirmed users, for a future incident:

```sql
select email, created_at
from auth.users
where email_confirmed_at is null
  and created_at > '2026-09-08'
order by created_at desc;
```

Check the list before deleting; a confirmed, signed-in address is a real
person and must not be swept up.

`supabase-remote` is read-only, so deletes need the Management API's
`database/query` endpoint (same token as above). Deleting straight from
`auth.users` fails: `profiles` (and a few others) reference it with `ON DELETE
RESTRICT`, not cascade, and a `profiles` row is created on signup, before
confirmation. Delete `profiles` first, in the same transaction:

```bash
TOKEN=$(python3 -c "import json;print(json.load(open('.mcp.json'))['mcpServers']['supabase-remote']['env']['SUPABASE_ACCESS_TOKEN'])")
REF=jdmhjakxhtghsbnstyou

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "begin; delete from profiles where id in (<ids>) and id in (select id from auth.users where email_confirmed_at is null); with removed as (delete from auth.users where id in (<ids>) and email_confirmed_at is null returning email) select count(*), array_agg(email) from removed; commit;"}' \
  https://api.supabase.com/v1/projects/$REF/database/query
```

The `email_confirmed_at is null` re-check inside the delete (not just in the
SELECT above) matters: it guards against someone confirming in the gap between
listing and deleting.
