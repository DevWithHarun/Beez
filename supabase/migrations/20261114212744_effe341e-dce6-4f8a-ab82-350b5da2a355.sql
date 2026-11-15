CREATE OR REPLACE FUNCTION public.advance_rider(order_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  UPDATE public.orders
  SET rider_lat = rider_lat + (drop_lat - rider_lat) * 0.12,
      rider_lng = rider_lng + (drop_lng - rider_lng) * 0.12,
      updated_at = now()
  WHERE id = advance_rider.order_id
    AND rider_id = auth.uid()
    AND status IN ('In Transit', 'Out for Delivery')
    AND rider_lat IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the assigned rider can update this delivery';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_rider(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_rider(text) TO authenticated;