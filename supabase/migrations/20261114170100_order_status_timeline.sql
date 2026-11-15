CREATE TABLE public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_status_events_order_id_created_at_idx
  ON public.order_status_events (order_id, created_at);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view order status events"
  ON public.order_status_events FOR SELECT USING (true);

GRANT SELECT ON public.order_status_events TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_order_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_events (order_id, status, created_at)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.updated_at, now()));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_events (order_id, status, created_at)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.updated_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_order_status_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER orders_log_status_event
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_event();

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_events;
