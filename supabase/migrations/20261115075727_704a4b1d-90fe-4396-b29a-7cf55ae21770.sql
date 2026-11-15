-- 1. Rider vehicle + shift start
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS plate text,
  ADD COLUMN IF NOT EXISTS online_since timestamptz;

CREATE OR REPLACE FUNCTION public.set_rider_online(_online boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _online IS NULL THEN RAISE EXCEPTION 'Availability state is required'; END IF;
  IF NOT _online AND EXISTS (
    SELECT 1 FROM public.orders WHERE rider_id = auth.uid() AND status IN ('Assigned', 'In Transit', 'Out for Delivery')
  ) THEN
    RAISE EXCEPTION 'You have an active delivery and cannot go offline';
  END IF;
  UPDATE public.riders
  SET online = _online,
      online_since = CASE WHEN _online THEN COALESCE(CASE WHEN online THEN online_since END, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile first'; END IF;
END; $$;

-- 2. Handover codes (server-only)
CREATE TABLE public.order_handover_codes (
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pickup', 'dropoff')),
  nonce text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, kind)
);
GRANT ALL ON public.order_handover_codes TO service_role;
ALTER TABLE public.order_handover_codes ENABLE ROW LEVEL SECURITY;

-- Completes a verified handover atomically; called only by the server after checking the signed code.
CREATE OR REPLACE FUNCTION public.service_complete_handover(_order_id text, _kind text, _rider_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.rider_id IS DISTINCT FROM _rider_id THEN RAISE EXCEPTION 'This is not your delivery'; END IF;
  IF _kind = 'pickup' AND o.status <> 'Assigned' THEN RAISE EXCEPTION 'Pickup is already confirmed'; END IF;
  IF _kind = 'dropoff' AND o.status NOT IN ('In Transit', 'Out for Delivery') THEN RAISE EXCEPTION 'Pick the order up first'; END IF;

  UPDATE public.order_handover_codes SET used_at = now(), used_by = _rider_id
  WHERE order_id = _order_id AND kind = _kind AND used_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This code has already been used'; END IF;

  IF _kind = 'pickup' THEN
    UPDATE public.orders SET status = 'In Transit', updated_at = now() WHERE id = _order_id;
    RETURN 'In Transit';
  END IF;
  UPDATE public.orders
  SET status = 'Delivered', delivered_at = now(), updated_at = now(),
      payment_status = CASE WHEN payment_method = 'Cash on Delivery' THEN 'Paid' ELSE payment_status END,
      rider_lat = drop_lat, rider_lng = drop_lng
  WHERE id = _order_id;
  RETURN 'Delivered';
END; $$;
REVOKE ALL ON FUNCTION public.service_complete_handover(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_complete_handover(text, text, uuid) TO service_role;

-- 3. Riders can only tap "arriving"; pickup and delivery need a handover scan.
CREATE OR REPLACE FUNCTION public.advance_order_status(order_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur text;
BEGIN
  SELECT status INTO cur FROM public.orders WHERE id = order_id AND rider_id = auth.uid() FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Not your order'; END IF;
  IF cur = 'Assigned' THEN RAISE EXCEPTION 'Scan the shop''s pickup QR code (or enter its code) to confirm pickup'; END IF;
  IF cur = 'Out for Delivery' THEN RAISE EXCEPTION 'Scan the customer''s delivery QR code (or enter its code) to finish'; END IF;
  IF cur <> 'In Transit' THEN RAISE EXCEPTION 'Order cannot be advanced'; END IF;
  UPDATE public.orders SET status = 'Out for Delivery', updated_at = now() WHERE id = order_id;
  RETURN 'Out for Delivery';
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_delivery(_order_id text, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Show your delivery QR code to the rider to confirm delivery';
END; $$;

-- 4. Settlement ledger
CREATE TABLE public.order_settlements (
  order_id text PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id uuid,
  merchant_id uuid,
  rider_amount_kes integer NOT NULL DEFAULT 0,
  merchant_amount_kes integer NOT NULL DEFAULT 0,
  cash_collected_kes integer NOT NULL DEFAULT 0,
  trip_km numeric NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_settlements TO authenticated;
GRANT ALL ON public.order_settlements TO service_role;
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders view own settlements" ON public.order_settlements FOR SELECT TO authenticated USING (rider_id = auth.uid());
CREATE POLICY "Merchants view own settlements" ON public.order_settlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = order_settlements.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Admins view settlements" ON public.order_settlements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX order_settlements_rider_idx ON public.order_settlements (rider_id, settled_at DESC);

CREATE OR REPLACE FUNCTION public.trip_km(_a_lat double precision, _a_lng double precision, _b_lat double precision, _b_lng double precision)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT round((2 * 6371 * asin(sqrt(
    power(sin(radians(_b_lat - _a_lat) / 2), 2) +
    cos(radians(_a_lat)) * cos(radians(_b_lat)) * power(sin(radians(_b_lng - _a_lng) / 2), 2)
  )))::numeric, 2)
$$;

CREATE OR REPLACE FUNCTION public.record_order_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NEW.status = 'Delivered' AND OLD.status IS DISTINCT FROM 'Delivered' THEN
    INSERT INTO public.order_settlements (order_id, rider_id, merchant_id, rider_amount_kes, merchant_amount_kes, cash_collected_kes, trip_km, settled_at)
    VALUES (NEW.id, NEW.rider_id, NEW.merchant_id, COALESCE(NEW.rider_earning_kes, 0),
            GREATEST(NEW.total_kes - NEW.delivery_fee_kes - NEW.service_fee_kes, 0),
            CASE WHEN NEW.payment_method = 'Cash on Delivery' THEN NEW.total_kes ELSE 0 END,
            public.trip_km(NEW.pickup_lat, NEW.pickup_lng, NEW.drop_lat, NEW.drop_lng),
            COALESCE(NEW.delivered_at, now()))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_order_settlement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER orders_record_settlement AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_settlement();

INSERT INTO public.order_settlements (order_id, rider_id, merchant_id, rider_amount_kes, merchant_amount_kes, cash_collected_kes, trip_km, settled_at)
SELECT o.id, o.rider_id, o.merchant_id, COALESCE(o.rider_earning_kes, 0),
       GREATEST(o.total_kes - o.delivery_fee_kes - o.service_fee_kes, 0),
       CASE WHEN o.payment_method = 'Cash on Delivery' THEN o.total_kes ELSE 0 END,
       public.trip_km(o.pickup_lat, o.pickup_lng, o.drop_lat, o.drop_lng),
       COALESCE(o.delivered_at, o.updated_at)
FROM public.orders o WHERE o.status = 'Delivered'
ON CONFLICT (order_id) DO NOTHING;

-- Rider payouts draw on the settlement ledger.
CREATE OR REPLACE FUNCTION public.rider_request_mpesa_payout(_amount_kes integer, _idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  current_rider public.riders;
  normalized_phone text;
  existing_request public.rider_payout_requests;
  earned_amount bigint;
  reserved_amount bigint;
  request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a payout'; END IF;
  IF _amount_kes IS NULL OR _amount_kes < 1 OR _amount_kes > 250000 OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Enter a payout amount between KES 1 and KES 250,000';
  END IF;
  SELECT * INTO current_rider FROM public.riders WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile before requesting a payout'; END IF;
  SELECT * INTO existing_request FROM public.rider_payout_requests WHERE rider_id = auth.uid() AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_request.amount_kes <> _amount_kes THEN RAISE EXCEPTION 'This payout request key has already been used'; END IF;
    RETURN existing_request.id;
  END IF;
  normalized_phone := regexp_replace(current_rider.phone, '\D', '', 'g');
  IF length(normalized_phone) = 10 AND normalized_phone LIKE '0%' THEN
    normalized_phone := '254' || substr(normalized_phone, 2);
  ELSIF length(normalized_phone) = 9 AND (normalized_phone LIKE '7%' OR normalized_phone LIKE '1%') THEN
    normalized_phone := '254' || normalized_phone;
  END IF;
  IF length(normalized_phone) <> 12 OR normalized_phone NOT LIKE '254%' THEN
    RAISE EXCEPTION 'Update your rider profile with a valid Kenyan M-Pesa phone number';
  END IF;
  SELECT COALESCE(SUM(rider_amount_kes), 0) INTO earned_amount FROM public.order_settlements WHERE rider_id = auth.uid();
  SELECT COALESCE(SUM(amount_kes), 0) INTO reserved_amount FROM public.rider_payout_requests
  WHERE rider_id = auth.uid() AND status IN ('Requested', 'Processing', 'Review', 'Paid');
  IF _amount_kes > GREATEST(earned_amount - reserved_amount, 0) THEN RAISE EXCEPTION 'Payout amount exceeds your available earnings'; END IF;
  INSERT INTO public.rider_payout_requests (rider_id, amount_kes, destination_phone, idempotency_key)
  VALUES (auth.uid(), _amount_kes, normalized_phone, _idempotency_key) RETURNING id INTO request_id;
  RETURN request_id;
END; $$;

-- 5. Nearby offers (3 km from the rider's latest location)
DROP FUNCTION IF EXISTS public.rider_available_orders();
CREATE FUNCTION public.rider_available_orders()
RETURNS TABLE(id text, merchant_name text, pickup_area text, customer_area text, items_summary text, total_kes integer, status text,
  pickup_lat double precision, pickup_lng double precision, drop_lat double precision, drop_lng double precision, rider_id uuid,
  rider_lat double precision, rider_lng double precision, delivery_fee_kes integer, payment_status text, payment_method text,
  created_at timestamptz, updated_at timestamptz, assigned_at timestamptz, delivered_at timestamptz, rider_earning_kes integer,
  merchant_response text, merchant_response_deadline timestamptz, distance_km numeric, trip_km numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r public.riders;
BEGIN
  SELECT * INTO r FROM public.riders WHERE riders.id = auth.uid();
  IF auth.uid() IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile first'; END IF;
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
      AND o.status IN ('Preparing', 'Pending', 'Ready for Pickup')
      AND o.merchant_response <> 'awaiting'
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
  SELECT * INTO o FROM public.orders WHERE id = accept_order.order_id;
  IF FOUND AND public.trip_km(rider.lat, rider.lng, o.pickup_lat, o.pickup_lng) > 3 THEN
    RAISE EXCEPTION 'This job is more than 3 km away';
  END IF;
  -- Conditional update: only one rider can win the job.
  UPDATE public.orders
  SET rider_id = auth.uid(), status = 'Assigned', assigned_at = now(),
      rider_lat = rider.lat, rider_lng = rider.lng, rider_heading = rider.heading, rider_location_at = rider.location_at,
      updated_at = now()
  WHERE id = accept_order.order_id AND rider_id IS NULL
    AND status IN ('Preparing', 'Pending', 'Ready for Pickup') AND merchant_response <> 'awaiting';
  IF NOT FOUND THEN RAISE EXCEPTION 'Another rider took this job'; END IF;
END; $$;

-- 6. Rider contact for the order's shopper and shop
CREATE OR REPLACE FUNCTION public.order_rider_contact(_order_id text)
RETURNS TABLE(full_name text, phone text, vehicle_type text, plate text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT r.full_name, r.phone, r.vehicle_type, r.plate
  FROM public.orders o JOIN public.riders r ON r.id = o.rider_id
  WHERE o.id = _order_id
    AND o.status IN ('Assigned', 'In Transit', 'Out for Delivery')
    AND (o.customer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = o.merchant_id AND m.owner_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'))
$$;
REVOKE ALL ON FUNCTION public.order_rider_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_rider_contact(text) TO authenticated;