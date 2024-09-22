drop function if exists "public"."add_or_update_attendance_with_tents"(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[]);

alter table "public"."attendances" disable row level security;

alter table "public"."group_members" disable row level security;

alter table "public"."groups" disable row level security;

alter table "public"."profiles" disable row level security;

alter table "public"."tent_visits" alter column "visit_date" set not null;

alter table "public"."tent_visits" alter column "visit_date" set data type date using "visit_date"::date;

alter table "public"."tent_visits" disable row level security;

alter table "public"."tents" disable row level security;

alter table "public"."winning_criteria" disable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date date, p_beer_count integer, p_tent_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tent_id UUID;
BEGIN
  -- Insert or update the attendance record
  INSERT INTO attendances (user_id, date, beer_count)
  VALUES (p_user_id, p_date, p_beer_count)
  ON CONFLICT (user_id, date)
  DO UPDATE SET beer_count = p_beer_count;

  -- Delete existing tent visits for this date
  DELETE FROM tent_visits
  WHERE user_id = p_user_id AND visit_date = p_date;

  -- Insert new tent visits
  FOREACH v_tent_id IN ARRAY p_tent_ids
  LOOP
    INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
    VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
  END LOOP;
END;
$function$
;


