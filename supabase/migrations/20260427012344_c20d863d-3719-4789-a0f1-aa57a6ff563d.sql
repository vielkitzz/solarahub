CREATE OR REPLACE FUNCTION public.get_owner_display_info(_user_id uuid)
RETURNS TABLE(display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      raw_user_meta_data->>'preferred_username',
      email
    ) AS display_name,
    raw_user_meta_data->>'avatar_url' AS avatar_url
  FROM auth.users
  WHERE id = _user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_display_info(uuid) TO anon, authenticated;