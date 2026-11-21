-- Lists a user's Storage objects so account deletion can remove the files
-- (deleting the auth user leaves them behind). PostgREST does not expose the
-- storage schema, hence the RPC. Service role only.
CREATE OR REPLACE FUNCTION public.user_storage_objects(p_user_id uuid)
RETURNS TABLE (bucket_id text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.bucket_id, o.name
  FROM storage.objects o
  WHERE o.owner_id = p_user_id::text;
$$;

REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_objects(uuid) TO service_role;
