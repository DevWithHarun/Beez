CREATE OR REPLACE FUNCTION public.admin_set_merchant_owner(
  _merchant_id uuid,
  _owner_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change merchant ownership';
  END IF;

  IF _merchant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.merchants WHERE id = _merchant_id
  ) THEN
    RAISE EXCEPTION 'Merchant was not found';
  END IF;

  IF NULLIF(BTRIM(_owner_email), '') IS NULL THEN
    UPDATE public.merchants SET owner_id = NULL WHERE id = _merchant_id;
    RETURN;
  END IF;

  SELECT u.id INTO target_user_id
  FROM auth.users AS u
  WHERE LOWER(u.email) = LOWER(BTRIM(_owner_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for %', BTRIM(_owner_email);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE owner_id = target_user_id AND id <> _merchant_id
  ) THEN
    RAISE EXCEPTION 'That account already owns another merchant';
  END IF;

  UPDATE public.merchants SET owner_id = target_user_id WHERE id = _merchant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_merchant_owner(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_owner(uuid, text) TO authenticated;
