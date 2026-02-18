-- Prevent duplicate verified Instagram bindings and add atomic transfer helper.

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_verified_instagram_username_unique
  ON profiles (lower(instagram_username))
  WHERE is_instagram_verified = true
    AND instagram_username IS NOT NULL;

CREATE OR REPLACE FUNCTION transfer_verified_instagram_binding(
  p_old_owner_id uuid,
  p_new_owner_id uuid,
  p_instagram_username text,
  p_instagram_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized_username text;
BEGIN
  v_normalized_username := lower(trim(leading '@' FROM p_instagram_username));

  UPDATE profiles
  SET
    instagram_username = NULL,
    instagram_avatar_url = NULL,
    is_instagram_verified = false
  WHERE id = p_old_owner_id
    AND is_instagram_verified = true
    AND lower(instagram_username) = v_normalized_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Old owner binding not found for %', v_normalized_username
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE profiles
  SET
    instagram_username = v_normalized_username,
    instagram_avatar_url = p_instagram_avatar_url,
    is_instagram_verified = true,
    avatar_url = COALESCE(p_instagram_avatar_url, avatar_url)
  WHERE id = p_new_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner profile not found: %', p_new_owner_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_verified_instagram_binding(uuid, uuid, text, text) TO authenticated;
