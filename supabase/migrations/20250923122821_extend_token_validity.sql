-- Update the join_group_with_token function to provide detailed error information
-- and extend token validity to 7 days

-- First, update the generate_group_token function to set expiration to 7 days
CREATE OR REPLACE FUNCTION generate_group_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a new UUID token
  NEW.invite_token := gen_random_uuid();
  -- Set the token expiration to 7 days from now
  NEW.token_expiration := NOW() + INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the renew_group_token function to set expiration to 7 days
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

  -- Update the group with the new token and set the expiration to 7 days from now
  UPDATE groups
  SET invite_token = new_token,
      token_expiration = NOW() + INTERVAL '7 days'
  WHERE id = p_group_id;

  RETURN new_token;
END;
$function$;

-- Drop the existing join_group_with_token function to allow return type change
DROP FUNCTION IF EXISTS public.join_group_with_token(uuid, uuid);

CREATE OR REPLACE FUNCTION public.join_group_with_token(
    p_user_id uuid,
    p_token uuid
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
  v_group_name TEXT;
  v_token_expires_at TIMESTAMP;
  v_token_expired BOOLEAN := FALSE;
  v_token_not_found BOOLEAN := FALSE;
BEGIN
  -- Check if the token exists and is still valid
  SELECT id, name, token_expiration INTO v_group_id, v_group_name, v_token_expires_at
  FROM groups
  WHERE invite_token = p_token;

  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TOKEN_NOT_FOUND',
      'message', 'Invalid or expired invitation token'
    );
  END IF;

  -- Check if token has expired
  IF v_token_expires_at <= NOW() THEN
    v_token_expired := TRUE;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TOKEN_EXPIRED',
      'message', 'This invitation token has expired',
      'expired_at', v_token_expires_at,
      'group_name', v_group_name
    );
  END IF;

  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM group_members WHERE user_id = p_user_id AND group_id = v_group_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_MEMBER',
      'message', 'You are already a member of this group',
      'group_name', v_group_name
    );
  END IF;

  -- Add the user to the group
  INSERT INTO group_members (user_id, group_id)
  VALUES (p_user_id, v_group_id);

  -- Return success with group information
  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'group_name', v_group_name,
    'message', 'Successfully joined the group!'
  );
END;
$function$;
