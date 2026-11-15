-- Beez AI operations agent: merchant order response window, server-controlled deadlines, audit trail.

CREATE TABLE IF NOT EXISTS public.order_response_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  merchant_response_seconds integer NOT NULL DEFAULT 120
    CHECK (merchant_response_seconds BETWEEN 30 AND 3600),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.order_response_policy TO authenticated;
GRANT ALL ON public.order_response_policy TO service_role;
ALTER TABLE public.order_response_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read order response policy"
  ON public.order_response_policy FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update order response policy"
  ON public.order_response_policy FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER order_response_policy_touch
  BEFORE UPDATE ON public.order_response_policy
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();
INSERT INTO public.order_response_policy (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_response text NOT NULL DEFAULT 'not_required'
    CHECK (merchant_response IN ('not_required', 'awaiting', 'accepted', 'declined', 'expired')),
  ADD COLUMN IF NOT EXISTS merchant_response_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_response_via text
    CHECK (merchant_response_via IS NULL OR merchant_response_via IN ('voice', 'touch')),
  ADD COLUMN IF NOT EXISTS merchant_decline_reason text
    CHECK (merchant_decline_reason IS NULL OR char_length(merchant_decline_reason) <= 300);

CREATE INDEX IF NOT EXISTS orders_awaiting_merchant_idx
  ON public.orders (merchant_response_deadline)
  WHERE merchant_response = 'awaiting';

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  actor_id uuid,
  event_type text NOT NULL,
  channel text NOT NULL DEFAULT 'system' CHECK (channel IN ('voice', 'touch', 'system')),
  request_id uuid UNIQUE,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own order events"
  ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.merchants AS m
    WHERE m.id = order_events.merchant_id AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins view order events"
  ON public.order_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS order_events_order_created_idx
  ON public.order_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_events_merchant_created_idx
  ON public.order_events (merchant_id, created_at DESC);

-- Response fields are only set by the server: on insert from policy, afterwards only by agent functions.
CREATE OR REPLACE FUNCTION public.orders_guard_merchant_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  window_seconds integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.merchant_responded_at := NULL;
    NEW.merchant_response_via := NULL;
    NEW.merchant_decline_reason := NULL;
    IF NEW.merchant_id IS NOT NULL AND NEW.status = 'Pending' THEN
      SELECT p.merchant_response_seconds INTO window_seconds
      FROM public.order_response_policy AS p WHERE p.id;
      NEW.merchant_response := 'awaiting';
      NEW.merchant_response_deadline := now() + make_interval(secs => COALESCE(window_seconds, 120));
    ELSE
      NEW.merchant_response := 'not_required';
      NEW.merchant_response_deadline := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('beez.order_agent', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.merchant_response := OLD.merchant_response;
  NEW.merchant_response_deadline := OLD.merchant_response_deadline;
  NEW.merchant_responded_at := OLD.merchant_responded_at;
  NEW.merchant_response_via := OLD.merchant_response_via;
  NEW.merchant_decline_reason := OLD.merchant_decline_reason;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_guard_merchant_response() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_guard_merchant_response ON public.orders;
CREATE TRIGGER orders_guard_merchant_response
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_guard_merchant_response();

CREATE OR REPLACE FUNCTION public.orders_log_response_required()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.merchant_response = 'awaiting' THEN
    INSERT INTO public.order_events (order_id, merchant_id, event_type, channel, details)
    VALUES (
      NEW.id, NEW.merchant_id, 'MERCHANT_ORDER_RESPONSE_REQUIRED', 'system',
      jsonb_build_object('deadline_at', NEW.merchant_response_deadline, 'required_action', 'ACCEPT_OR_DECLINE')
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_log_response_required() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_log_response_required ON public.orders;
CREATE TRIGGER orders_log_response_required
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_log_response_required();

-- Expire overdue responses. Never accepts or declines on the merchant's behalf.
CREATE OR REPLACE FUNCTION public.expire_overdue_merchant_responses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expired_count integer;
BEGIN
  PERFORM set_config('beez.order_agent', 'on', true);
  WITH due AS (
    SELECT o.id
    FROM public.orders AS o
    WHERE o.merchant_response = 'awaiting'
      AND o.merchant_response_deadline <= now()
    ORDER BY o.merchant_response_deadline
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  ), updated AS (
    UPDATE public.orders AS o
    SET merchant_response = 'expired',
        status = CASE WHEN o.status = 'Pending' THEN 'Cancelled' ELSE o.status END,
        updated_at = now()
    FROM due
    WHERE o.id = due.id
    RETURNING o.id, o.merchant_id, o.merchant_response_deadline
  ), logged AS (
    INSERT INTO public.order_events (order_id, merchant_id, event_type, channel, details)
    SELECT u.id, u.merchant_id, 'MERCHANT_RESPONSE_EXPIRED', 'system',
           jsonb_build_object('deadline_at', u.merchant_response_deadline)
    FROM updated AS u
    RETURNING 1
  )
  SELECT count(*) INTO expired_count FROM logged;
  PERFORM set_config('beez.order_agent', 'off', true);
  RETURN expired_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_overdue_merchant_responses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_overdue_merchant_responses() TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_respond_to_order(
  _order_id text,
  _decision text,
  _channel text,
  _request_id uuid,
  _reason text DEFAULT NULL,
  _transcript text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target public.orders;
  previous public.order_events;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to respond to orders';
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Choose accept or decline';
  END IF;
  IF _channel IS NULL OR _channel NOT IN ('voice', 'touch') THEN
    RAISE EXCEPTION 'Invalid response channel';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'A request key is required';
  END IF;

  SELECT * INTO previous FROM public.order_events WHERE request_id = _request_id;
  IF FOUND THEN
    IF previous.actor_id IS DISTINCT FROM auth.uid() OR previous.order_id <> _order_id THEN
      RAISE EXCEPTION 'This request key has already been used';
    END IF;
    RETURN previous.details -> 'result';
  END IF;

  SELECT o.* INTO target
  FROM public.orders AS o
  JOIN public.merchants AS m ON m.id = o.merchant_id
  WHERE o.id = _order_id AND m.owner_id = auth.uid()
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF target.merchant_response <> 'awaiting' OR target.status <> 'Pending' THEN
    RETURN jsonb_build_object(
      'outcome', 'not_awaiting',
      'order_id', target.id,
      'status', target.status,
      'merchant_response', target.merchant_response
    );
  END IF;

  PERFORM set_config('beez.order_agent', 'on', true);

  IF now() >= target.merchant_response_deadline THEN
    UPDATE public.orders
    SET merchant_response = 'expired', status = 'Cancelled', updated_at = now()
    WHERE id = target.id;
    INSERT INTO public.order_events (order_id, merchant_id, event_type, channel, details)
    VALUES (target.id, target.merchant_id, 'MERCHANT_RESPONSE_EXPIRED', 'system',
            jsonb_build_object('deadline_at', target.merchant_response_deadline));
    PERFORM set_config('beez.order_agent', 'off', true);
    RETURN jsonb_build_object(
      'outcome', 'expired', 'order_id', target.id,
      'status', 'Cancelled', 'merchant_response', 'expired'
    );
  END IF;

  IF _decision = 'accept' THEN
    UPDATE public.orders
    SET merchant_response = 'accepted', status = 'Preparing',
        merchant_responded_at = now(), merchant_response_via = _channel, updated_at = now()
    WHERE id = target.id;
    result := jsonb_build_object(
      'outcome', 'accepted', 'order_id', target.id,
      'status', 'Preparing', 'merchant_response', 'accepted'
    );
  ELSE
    UPDATE public.orders
    SET merchant_response = 'declined', status = 'Cancelled',
        merchant_responded_at = now(), merchant_response_via = _channel,
        merchant_decline_reason = NULLIF(left(btrim(COALESCE(_reason, '')), 300), ''),
        updated_at = now()
    WHERE id = target.id;
    result := jsonb_build_object(
      'outcome', 'declined', 'order_id', target.id,
      'status', 'Cancelled', 'merchant_response', 'declined'
    );
  END IF;

  INSERT INTO public.order_events (order_id, merchant_id, actor_id, event_type, channel, request_id, details)
  VALUES (
    target.id, target.merchant_id, auth.uid(),
    CASE WHEN _decision = 'accept' THEN 'MERCHANT_ACCEPTED' ELSE 'MERCHANT_DECLINED' END,
    _channel, _request_id,
    jsonb_build_object('result', result, 'transcript', left(COALESCE(_transcript, ''), 500))
  );

  PERFORM set_config('beez.order_agent', 'off', true);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.merchant_respond_to_order(text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_respond_to_order(text, text, text, uuid, text, text) TO authenticated;

-- Merchants must accept before preparing; unanswered orders cannot be prepared or cancelled here.
CREATE OR REPLACE FUNCTION public.merchant_prepare_order(_order_id text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _status NOT IN ('Ready for Pickup','Cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.orders o SET status=_status, updated_at=now()
  FROM public.merchants m
  WHERE o.id=_order_id AND m.id=o.merchant_id AND m.owner_id=auth.uid()
    AND o.status IN ('Pending','Preparing') AND o.rider_id IS NULL
    AND o.merchant_response <> 'awaiting';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order cannot be changed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.merchant_prepare_order(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merchant_prepare_order(text,text) TO authenticated;

-- Riders cannot take an order the merchant has not yet accepted.
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
  WHERE id = accept_order.order_id
    AND rider_id IS NULL
    AND status IN ('Preparing', 'Pending', 'Ready for Pickup')
    AND merchant_response <> 'awaiting';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order is no longer available';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
  END IF;
END $$;