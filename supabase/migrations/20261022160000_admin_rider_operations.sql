CREATE OR REPLACE FUNCTION public.admin_set_rider_online(
  _rider_id uuid,
  _online boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rider_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change rider availability';
  END IF;

  IF _rider_id IS NULL OR _online IS NULL THEN
    RAISE EXCEPTION 'A rider and availability state are required';
  END IF;

  SELECT true INTO rider_exists
  FROM public.riders
  WHERE id = _rider_id
  FOR UPDATE;

  IF rider_exists IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rider was not found';
  END IF;

  IF NOT _online AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE rider_id = _rider_id
      AND status IN ('Assigned', 'In Transit', 'Out for Delivery')
  ) THEN
    RAISE EXCEPTION 'Rider has an active delivery and cannot be set offline';
  END IF;

  UPDATE public.riders
  SET online = _online,
      updated_at = now()
  WHERE id = _rider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_rider_online(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_rider_online(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_order(order_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rider public.riders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT * INTO rider
  FROM public.riders
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create your rider profile first';
  END IF;

  IF NOT rider.online THEN
    RAISE EXCEPTION 'Go online before accepting deliveries';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE rider_id = auth.uid()
      AND status IN ('Assigned', 'In Transit', 'Out for Delivery')
  ) THEN
    RAISE EXCEPTION 'Finish your current delivery first';
  END IF;

  UPDATE public.orders
  SET rider_id = auth.uid(),
      status = 'Assigned',
      assigned_at = now(),
      rider_lat = COALESCE(rider.lat, pickup_lat),
      rider_lng = COALESCE(rider.lng, pickup_lng),
      updated_at = now()
  WHERE id = order_id
    AND rider_id IS NULL
    AND status IN ('Preparing', 'Pending', 'Ready for Pickup');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order is no longer available';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(_order_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update order status';
  END IF;

  IF _order_id IS NULL OR _status IS NULL OR _status NOT IN (
    'Pending',
    'Preparing',
    'Ready for Pickup',
    'Assigned',
    'In Transit',
    'Out for Delivery',
    'Cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid order or order status';
  END IF;

  IF _status IN ('Assigned', 'In Transit', 'Out for Delivery')
     AND NOT EXISTS (
       SELECT 1 FROM public.orders
       WHERE id = _order_id AND rider_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Assign a rider before starting a delivery';
  END IF;

  UPDATE public.orders
  SET status = _status,
      updated_at = now()
  WHERE id = _order_id
    AND status <> 'Delivered';

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
      RAISE EXCEPTION 'Delivered orders can only be completed by customer confirmation';
    END IF;
    RAISE EXCEPTION 'Order % was not found', _order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(text, text) TO authenticated;
