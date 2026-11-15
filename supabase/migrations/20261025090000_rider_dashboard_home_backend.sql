CREATE OR REPLACE FUNCTION public.set_rider_online(_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF _online IS NULL THEN
    RAISE EXCEPTION 'Availability state is required';
  END IF;

  IF NOT _online AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE rider_id = auth.uid()
      AND status IN ('Assigned', 'In Transit', 'Out for Delivery')
  ) THEN
    RAISE EXCEPTION 'You have an active delivery and cannot go offline';
  END IF;

  UPDATE public.riders
  SET online = _online,
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create your rider profile first';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_rider_online(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rider_online(boolean) TO authenticated;
