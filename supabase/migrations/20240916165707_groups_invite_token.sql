ALTER TABLE public.groups
ADD COLUMN invite_token UUID,
ADD COLUMN token_expiration TIMESTAMP;

CREATE OR REPLACE FUNCTION generate_group_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a new UUID token
  NEW.invite_token := gen_random_uuid();
  -- Set the token expiration to 1 day from now
  NEW.token_expiration := NOW() + INTERVAL '1 day';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_group_token
BEFORE INSERT ON groups
FOR EACH ROW
EXECUTE FUNCTION generate_group_token();

CREATE OR REPLACE FUNCTION public.join_group_with_token(
    p_user_id uuid, 
    p_token uuid
) 
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
BEGIN
  -- Check if the token is valid
  SELECT id INTO v_group_id
  FROM groups
  WHERE invite_token = p_token AND token_expiration > NOW();

  IF v_group_id IS NULL THEN
    RETURN NULL; -- Invalid token
  END IF;

  -- Add the user to the group
  INSERT INTO group_members (user_id, group_id)
  VALUES (p_user_id, v_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN v_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.renew_group_token(
    p_group_id uuid
) 
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    new_token uuid;
BEGIN
    -- Generate a new UUID token
    new_token := gen_random_uuid();
    
    -- Update the group with the new token and set the expiration to 1 day from now
    UPDATE groups
    SET invite_token = new_token,
        token_expiration = NOW() + INTERVAL '1 day'
    WHERE id = p_group_id;

    RETURN new_token;
END;
$function$;
