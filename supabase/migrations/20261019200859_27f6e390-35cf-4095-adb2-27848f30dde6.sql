CREATE TABLE public.riders (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  online boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.riders TO authenticated;
GRANT ALL ON public.riders TO service_role;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders view own profile" ON public.riders FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Riders insert own profile" ON public.riders FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Riders update own profile" ON public.riders FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER riders_touch BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_rider() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.riders (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'phone', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_rider AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_rider();

ALTER TABLE public.orders
  ADD COLUMN rider_id uuid,
  ADD COLUMN rider_earning_kes integer NOT NULL DEFAULT 100,
  ADD COLUMN assigned_at timestamptz,
  ADD COLUMN delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.accept_order(order_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.riders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO r FROM public.riders WHERE id = auth.uid();
  IF EXISTS (SELECT 1 FROM public.orders WHERE rider_id = auth.uid() AND status IN ('Assigned','In Transit','Out for Delivery')) THEN
    RAISE EXCEPTION 'Finish your current delivery first';
  END IF;
  UPDATE public.orders SET rider_id = auth.uid(), status = 'Assigned', assigned_at = now(),
    rider_lat = COALESCE(r.lat, pickup_lat), rider_lng = COALESCE(r.lng, pickup_lng), updated_at = now()
  WHERE id = order_id AND rider_id IS NULL AND status IN ('Preparing','Pending');
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is no longer available'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.advance_order_status(order_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text; nxt text;
BEGIN
  SELECT status INTO cur FROM public.orders WHERE id = order_id AND rider_id = auth.uid() FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Not your order'; END IF;
  nxt := CASE cur WHEN 'Assigned' THEN 'In Transit' WHEN 'In Transit' THEN 'Out for Delivery' WHEN 'Out for Delivery' THEN 'Delivered' ELSE NULL END;
  IF nxt IS NULL THEN RAISE EXCEPTION 'Order cannot be advanced'; END IF;
  UPDATE public.orders SET status = nxt, updated_at = now(),
    delivered_at = CASE WHEN nxt = 'Delivered' THEN now() ELSE delivered_at END,
    rider_lat = CASE WHEN nxt = 'Delivered' THEN drop_lat ELSE rider_lat END,
    rider_lng = CASE WHEN nxt = 'Delivered' THEN drop_lng ELSE rider_lng END
  WHERE id = order_id;
  RETURN nxt;
END; $$;

CREATE OR REPLACE FUNCTION public.update_rider_location(lat double precision, lng double precision) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.riders SET lat = update_rider_location.lat, lng = update_rider_location.lng WHERE id = auth.uid();
  UPDATE public.orders SET rider_lat = update_rider_location.lat, rider_lng = update_rider_location.lng, updated_at = now()
  WHERE rider_id = auth.uid() AND status IN ('Assigned','In Transit','Out for Delivery');
END; $$;

REVOKE EXECUTE ON FUNCTION public.accept_order(text), public.advance_order_status(text), public.update_rider_location(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(text), public.advance_order_status(text), public.update_rider_location(double precision, double precision) TO authenticated;
