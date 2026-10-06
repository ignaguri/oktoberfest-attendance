-- Deleting a festival cascaded into data people created (reservations, plans,
-- achievements, location sessions, crowd reports, messages, share links). Make those
-- foreign keys block the delete instead, like attendances, groups and
-- tent_visits already do. Festival config (tents, prices, stats) and derived
-- caches still cascade.
ALTER TABLE public.reservations
  DROP CONSTRAINT reservations_festival_id_fkey,
  ADD CONSTRAINT reservations_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.day_plans
  DROP CONSTRAINT day_plans_festival_id_fkey,
  ADD CONSTRAINT day_plans_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.user_achievements
  DROP CONSTRAINT user_achievements_festival_id_fkey,
  ADD CONSTRAINT user_achievements_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.achievement_events
  DROP CONSTRAINT achievement_events_festival_id_fkey,
  ADD CONSTRAINT achievement_events_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.location_sessions
  DROP CONSTRAINT location_sessions_festival_id_fkey,
  ADD CONSTRAINT location_sessions_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.tent_crowd_reports
  DROP CONSTRAINT tent_crowd_reports_festival_id_fkey,
  ADD CONSTRAINT tent_crowd_reports_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.wrapped_shares
  DROP CONSTRAINT wrapped_shares_festival_id_fkey,
  ADD CONSTRAINT wrapped_shares_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);

ALTER TABLE public.group_messages
  DROP CONSTRAINT group_messages_festival_id_fkey,
  ADD CONSTRAINT group_messages_festival_id_fkey
    FOREIGN KEY (festival_id) REFERENCES public.festivals(id);
