ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rider_arrived_at timestamptz;

CREATE OR REPLACE FUNCTION public.rider_mark_arrived(_order_id text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  arrival_time timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  UPDATE public.orders
  SET status = CASE WHEN status = 'In Transit' THEN 'Out for Delivery' ELSE status END,
      rider_arrived_at = COALESCE(rider_arrived_at, now()),
      updated_at = CASE WHEN status = 'In Transit' THEN now() ELSE updated_at END
  WHERE id = _order_id
    AND rider_id = auth.uid()
    AND status IN ('In Transit', 'Out for Delivery')
  RETURNING rider_arrived_at INTO arrival_time;

  IF NOT FOUND THEN RAISE EXCEPTION 'This delivery cannot be marked arrived'; END IF;
  RETURN arrival_time;
END;
$$;

REVOKE ALL ON FUNCTION public.rider_mark_arrived(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_mark_arrived(text) TO authenticated;
