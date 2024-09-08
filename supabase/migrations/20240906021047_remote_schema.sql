set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_groups()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT group_id FROM group_members
  WHERE user_id = auth.uid();
END;
$function$
;


