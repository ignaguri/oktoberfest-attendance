-- Auth endpoint abuse detector.
--
-- Background: docs/superpowers/specs/2026-08-30-auth-captcha-and-rate-limits-design.md
--
-- A campaign drove ~960 unsolicited auth emails from account.prostcounter.fun
-- between Nov 2025 and Aug 2026, in bursts. Normal days sit near zero recovery
-- requests; burst days reached 60. Alert above 20 in a day.
select
  created_at::date                                          as day,
  count(*) filter (where payload->>'action' = 'user_recovery_requested')     as recovery_requests,
  count(*) filter (where payload->>'action' = 'user_confirmation_requested') as confirmation_requests
from auth.audit_log_entries
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;
