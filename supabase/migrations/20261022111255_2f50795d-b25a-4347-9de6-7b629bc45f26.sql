-- Shop catalogue is publicly viewable (active rows only)
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (active = true);

CREATE POLICY "Anyone can view active merchants"
  ON public.merchants FOR SELECT
  USING (active = true);

GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.merchants TO anon, authenticated;

-- Customers place their own orders
CREATE POLICY "Customers create own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

GRANT INSERT ON public.orders TO authenticated;

-- Customers can read and add item lines on their own orders
CREATE POLICY "Customers read own order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

CREATE POLICY "Customers create own order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

GRANT SELECT, INSERT ON public.order_items TO authenticated;

-- Customer confirms delivery with the 6-digit code shown on the order
CREATE OR REPLACE FUNCTION public.confirm_delivery(_order_id text, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to confirm your delivery';
  END IF;
  UPDATE public.orders
  SET status = 'Delivered',
      delivered_at = now(),
      updated_at = now(),
      payment_status = CASE WHEN payment_method = 'Cash on Delivery' THEN 'Paid' ELSE payment_status END,
      rider_lat = drop_lat,
      rider_lng = drop_lng
  WHERE id = _order_id
    AND customer_id = auth.uid()
    AND _code = right(_order_id, 6)
    AND status IN ('Assigned', 'In Transit', 'Out for Delivery');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That code does not match this order, or it is not out for delivery yet';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery(text, text) TO authenticated;

-- Riders can claim orders waiting for pickup
CREATE OR REPLACE FUNCTION public.accept_order(order_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.riders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO r FROM public.riders WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile first'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE rider_id = auth.uid() AND status IN ('Assigned','In Transit','Out for Delivery')) THEN
    RAISE EXCEPTION 'Finish your current delivery first';
  END IF;
  UPDATE public.orders SET rider_id = auth.uid(), status = 'Assigned', assigned_at = now(),
    rider_lat = COALESCE(r.lat, pickup_lat), rider_lng = COALESCE(r.lng, pickup_lng), updated_at = now()
  WHERE id = order_id AND rider_id IS NULL AND status IN ('Preparing','Pending','Ready for Pickup');
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is no longer available'; END IF;
END;
$function$;