-- Auth endpoint abuse detector.
--
-- Background: docs/superpowers/specs/2026-08-30-auth-captcha-and-rate-limits-design.md
--
-- A campaign drove ~960 unsolicited auth emails from account.prostcounter.fun
-- between Nov 2025 and Aug 2026, in bursts.
--
-- Threshold measured against 400 days of production auth.audit_log_entries,
-- not guessed:
--
--   191 days    0 recovery requests   <- 74% of days are exactly zero
--    29 days    1-5
--    33 days    6-20                  <- almost certainly campaign activity too
--     5 days    over 20               <- the visible peaks only
--   worst day 60, mean 9.9 across non-zero days
--
-- So alert above 5 per day, NOT above 20. Roughly 179 real users do not
-- organically produce 6-20 password resets in a day, so the 6-20 band is
-- abuse the old threshold ignored: 20 would have caught 5 abuse days while
-- missing 33. Above 5 fires on 38 of 258 days. Retune from the table above
-- rather than from intuition.
select
  created_at::date                                          as day,
  count(*) filter (where payload->>'action' = 'user_recovery_requested')     as recovery_requests,
  count(*) filter (where payload->>'action' = 'user_confirmation_requested') as confirmation_requests
from auth.audit_log_entries
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;
