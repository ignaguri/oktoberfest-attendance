-- Auth endpoint abuse detector.
--
-- A campaign drove ~960 unsolicited auth emails from account.prostcounter.fun
-- between Nov 2025 and Aug 2026, in bursts every one to three months. Roughly
-- 60% of rows in auth.users are that campaign rather than people.
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
-- abuse the higher threshold ignores: 20 would have caught 5 abuse days while
-- missing 33. Above 5 fires on 38 of the 258 days that have any auth audit
-- activity at all. Verified against production on 2026-08-31: the bands
-- above reproduce exactly, and query 1 returns the 2026-08-12..15 burst
-- (52, 54, 60, 16 recovery requests) and nothing else.
--
-- Retune from query 2 below rather than from intuition.

-- Query 1: the alert. Returns only days that breach the threshold, so an empty
-- result means nothing to look at. Run this one on a schedule.
select
  created_at::date                                                           as day,
  count(*) filter (where payload->>'action' = 'user_recovery_requested')     as recovery_requests,
  count(*) filter (where payload->>'action' = 'user_confirmation_requested') as confirmation_requests
from auth.audit_log_entries
where created_at > now() - interval '30 days'
group by 1
having count(*) filter (where payload->>'action' = 'user_recovery_requested') > 5
    or count(*) filter (where payload->>'action' = 'user_confirmation_requested') > 5
order by 1 desc;

-- Query 2: the distribution the threshold above was derived from. Window it
-- wide enough to cover several bursts, otherwise the bands are meaningless:
-- 30 days cannot reproduce a distribution measured over 400.
select
  case
    when recovery_requests = 0      then '0'
    when recovery_requests <= 5     then '1-5'
    when recovery_requests <= 20    then '6-20'
    else                                 'over 20'
  end                                   as band,
  count(*)                              as days,
  max(recovery_requests)                as worst_day
from (
  select
    created_at::date                                                       as day,
    count(*) filter (where payload->>'action' = 'user_recovery_requested') as recovery_requests
  from auth.audit_log_entries
  where created_at > now() - interval '400 days'
  group by 1
) daily
group by 1
order by 1;
