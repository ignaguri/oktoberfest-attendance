-- Feed types for day plans and tent reservations.
--
-- On its own because a new enum value cannot be used in the transaction that
-- adds it; the view that casts to these values is in the next migration.

ALTER TYPE public.activity_type_enum ADD VALUE IF NOT EXISTS 'day_plan';
ALTER TYPE public.activity_type_enum ADD VALUE IF NOT EXISTS 'tent_reservation';
