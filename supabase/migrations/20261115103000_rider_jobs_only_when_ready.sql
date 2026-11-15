-- Merchant-backed deliveries must be explicitly marked ready before a rider can claim them.
-- Orders without a merchant have no one who can perform that action.
UPDATE public.orders
SET status = 'Ready for Pickup', updated_at = now()
WHERE merchant_id IS NULL AND rider_id IS NULL AND status = 'Preparing';

CREATE OR REPLACE FUNCTION public.rider_available_orders()
RETURNS TABLE(
  id text, merchant_name text, pickup_area text, customer_area text, items_summary text,
  total_kes integer, status text, pickup_lat double precision, pickup_lng double precision,
  drop_lat double precision, drop_lng double precision, rider_id uuid, rider_lat double precision,
  rider_lng double precision, delivery_fee_kes integer, payment_status text, payment_method text,
  created_at timestamptz, updated_at timestamptz, assigned_at timestamptz, delivered_at timestamptz,
  rider_earning_kes integer, merchant_response text, merchant_response_deadline timestamptz,
  distance_km numeric, trip_km numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r public.riders;
BEGIN
  SELECT * INTO r FROM public.riders WHERE riders.id = auth.uid();
  IF auth.uid() IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Create your rider profile first';
  END IF;
  IF r.lat IS NULL OR r.lng IS NULL OR r.location_at IS NULL OR r.location_at < now() - interval '10 minutes' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT o.id, o.merchant_name, o.pickup_area, o.customer_area, o.items_summary, o.total_kes, o.status,
           o.pickup_lat, o.pickup_lng, o.drop_lat, o.drop_lng, o.rider_id, o.rider_lat, o.rider_lng,
           o.delivery_fee_kes, o.payment_status, o.payment_method, o.created_at, o.updated_at,
           o.assigned_at, o.delivered_at, o.rider_earning_kes, o.merchant_response, o.merchant_response_deadline,
           public.trip_km(r.lat, r.lng, o.pickup_lat, o.pickup_lng) AS distance_km,
           public.trip_km(o.pickup_lat, o.pickup_lng, o.drop_lat, o.drop_lng) AS trip_km
    FROM public.orders o
    WHERE o.rider_id IS NULL
      AND o.status = 'Ready for Pickup'
      AND o.merchant_response IS DISTINCT FROM 'awaiting'
  ) s
  WHERE s.distance_km <= 3
  ORDER BY s.distance_km ASC, s.created_at ASC
  LIMIT 30;
END; $$;
REVOKE ALL ON FUNCTION public.rider_available_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_available_orders() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_order(order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE rider public.riders; o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO rider FROM public.riders WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile first'; END IF;
  IF NOT rider.online THEN RAISE EXCEPTION 'Go online before accepting deliveries'; END IF;
  IF rider.lat IS NULL OR rider.location_at IS NULL OR rider.location_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Turn on location so Beez can offer you jobs nearby';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE rider_id = auth.uid() AND status IN ('Assigned', 'In Transit', 'Out for Delivery')) THEN
    RAISE EXCEPTION 'Finish your current delivery first';
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = accept_order.order_id FOR UPDATE;
  IF NOT FOUND OR o.rider_id IS NOT NULL THEN RAISE EXCEPTION 'This job is no longer available'; END IF;
  IF o.status <> 'Ready for Pickup' OR o.merchant_response = 'awaiting' THEN
    RAISE EXCEPTION 'The shop has not marked this order ready for pickup';
  END IF;
  IF public.trip_km(rider.lat, rider.lng, o.pickup_lat, o.pickup_lng) > 3 THEN
    RAISE EXCEPTION 'This job is more than 3 km away';
  END IF;

  UPDATE public.orders
  SET rider_id = auth.uid(), status = 'Assigned', assigned_at = now(),
      rider_lat = rider.lat, rider_lng = rider.lng, rider_heading = rider.heading,
      rider_location_at = rider.location_at, updated_at = now()
  WHERE id = accept_order.order_id AND rider_id IS NULL
    AND status = 'Ready for Pickup' AND merchant_response IS DISTINCT FROM 'awaiting';
  IF NOT FOUND THEN RAISE EXCEPTION 'Another rider took this job'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.accept_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(text) TO authenticated;