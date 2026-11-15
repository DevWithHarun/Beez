CREATE TABLE public.orders (
  id text PRIMARY KEY,
  merchant_name text NOT NULL,
  pickup_area text NOT NULL,
  customer_area text NOT NULL,
  items_summary text NOT NULL DEFAULT '',
  total_kes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Preparing',
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  drop_lat double precision NOT NULL,
  drop_lng double precision NOT NULL,
  rider_lat double precision,
  rider_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.advance_rider(order_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET rider_lat = rider_lat + (drop_lat - rider_lat) * 0.12,
      rider_lng = rider_lng + (drop_lng - rider_lng) * 0.12,
      updated_at = now()
  WHERE id = order_id
    AND status IN ('In Transit', 'Out for Delivery')
    AND rider_lat IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_rider(text) TO anon;
GRANT EXECUTE ON FUNCTION public.advance_rider(text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
