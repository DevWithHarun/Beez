-- Orders: replace the open read rule with role-scoped rules
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;

CREATE POLICY "Customers view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Merchants view own shop orders"
  ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = orders.merchant_id AND m.owner_id = auth.uid()));

CREATE POLICY "Riders view assigned orders"
  ON public.orders FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

CREATE POLICY "Admins view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.orders FROM anon;

-- Open jobs for riders, without customer identity or contact details
CREATE OR REPLACE FUNCTION public.rider_available_orders()
RETURNS TABLE (
  id text, merchant_name text, pickup_area text, customer_area text, items_summary text,
  total_kes integer, status text, pickup_lat double precision, pickup_lng double precision,
  drop_lat double precision, drop_lng double precision, rider_id uuid,
  rider_lat double precision, rider_lng double precision, delivery_fee_kes integer,
  payment_status text, payment_method text, created_at timestamptz, updated_at timestamptz,
  assigned_at timestamptz, delivered_at timestamptz, rider_earning_kes integer,
  merchant_response text, merchant_response_deadline timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.riders r WHERE r.id = auth.uid()) THEN
    RAISE EXCEPTION 'Create your rider profile first';
  END IF;
  RETURN QUERY
  SELECT o.id, o.merchant_name, o.pickup_area, o.customer_area, o.items_summary,
         o.total_kes, o.status, o.pickup_lat, o.pickup_lng, o.drop_lat, o.drop_lng, o.rider_id,
         o.rider_lat, o.rider_lng, o.delivery_fee_kes, o.payment_status, o.payment_method,
         o.created_at, o.updated_at, o.assigned_at, o.delivered_at, o.rider_earning_kes,
         o.merchant_response, o.merchant_response_deadline
  FROM public.orders o
  WHERE o.rider_id IS NULL
    AND o.status IN ('Preparing', 'Pending', 'Ready for Pickup')
  ORDER BY o.created_at DESC
  LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.rider_available_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_available_orders() TO authenticated;

-- Order timeline: visible only to people who can see the order itself
DROP POLICY IF EXISTS "Anyone can view order status events" ON public.order_status_events;
CREATE POLICY "Order participants view status events"
  ON public.order_status_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_events.order_id));
REVOKE SELECT ON public.order_status_events FROM anon;

-- Response time setting: merchants and admins only
DROP POLICY IF EXISTS "Signed-in users read order response policy" ON public.order_response_policy;
CREATE POLICY "Merchants and admins read order response policy"
  ON public.order_response_policy FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.owner_id = auth.uid())
  );