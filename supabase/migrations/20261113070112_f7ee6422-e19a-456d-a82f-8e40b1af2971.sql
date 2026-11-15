CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Kenyan mobile number -> 2547XXXXXXXX / 2541XXXXXXXX, or NULL when unusable.
CREATE OR REPLACE FUNCTION public.beez_kenyan_msisdn(_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE d text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
BEGIN
  IF length(d) = 10 AND d ~ '^0[17]' THEN d := '254' || substr(d, 2);
  ELSIF length(d) = 9 AND d ~ '^[17]' THEN d := '254' || d;
  END IF;
  IF d ~ '^254[17][0-9]{8}$' THEN RETURN d; END IF;
  RETURN NULL;
END $$;

-- 1. Refunds
CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid,
  destination_phone text,
  amount_kes integer NOT NULL CHECK (amount_kes > 0),
  reason text NOT NULL CHECK (reason IN ('merchant_declined', 'merchant_no_response')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'refunded', 'failed', 'rejected')),
  method text CHECK (method IN ('mpesa', 'manual')),
  mpesa_reference text,
  provider_conversation_id text,
  provider_originator_conversation_id text,
  failure_reason text,
  admin_note text,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.order_refunds TO authenticated;
GRANT ALL ON public.order_refunds TO service_role;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own refunds" ON public.order_refunds
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins view refunds" ON public.order_refunds
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX order_refunds_status_idx ON public.order_refunds (status, created_at DESC);
CREATE INDEX order_refunds_conversation_idx ON public.order_refunds (provider_conversation_id);
CREATE TRIGGER order_refunds_touch BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();

-- 2. Customer messages
CREATE TABLE public.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid,
  phone text,
  kind text NOT NULL CHECK (kind IN ('order_declined', 'order_expired', 'refund_sent')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind)
);
GRANT SELECT ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own notifications" ON public.customer_notifications
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins view notifications" ON public.customer_notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX customer_notifications_queue_idx ON public.customer_notifications (status, next_attempt_at);
CREATE TRIGGER customer_notifications_touch BEFORE UPDATE ON public.customer_notifications
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();

-- 3. Paid orders cancelled by decline/expiry become Refund Pending (runs after the response guard).
CREATE OR REPLACE FUNCTION public.orders_mark_refund_due()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.merchant_response = 'awaiting'
     AND NEW.merchant_response IN ('declined', 'expired')
     AND NEW.status = 'Cancelled'
     AND NEW.payment_status = 'Paid'
     AND NEW.payment_method <> 'Cash on Delivery'
     AND NEW.total_kes > 0 THEN
    NEW.payment_status := 'Refund Pending';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_mark_refund_due BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_mark_refund_due();

-- 4. Queue the refund and the customer message.
CREATE OR REPLACE FUNCTION public.orders_queue_customer_followups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msisdn text;
  refund_due boolean;
BEGIN
  IF NOT (OLD.merchant_response = 'awaiting' AND NEW.merchant_response IN ('declined', 'expired')) THEN
    RETURN NULL;
  END IF;

  msisdn := public.beez_kenyan_msisdn(NEW.customer_phone);
  IF msisdn IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT public.beez_kenyan_msisdn(u.phone) INTO msisdn FROM auth.users AS u WHERE u.id = NEW.customer_id;
  END IF;

  refund_due := NEW.payment_status = 'Refund Pending' AND OLD.payment_status IS DISTINCT FROM 'Refund Pending';

  IF refund_due THEN
    INSERT INTO public.order_refunds (order_id, customer_id, destination_phone, amount_kes, reason)
    VALUES (
      NEW.id, NEW.customer_id, msisdn, NEW.total_kes,
      CASE WHEN NEW.merchant_response = 'declined' THEN 'merchant_declined' ELSE 'merchant_no_response' END
    )
    ON CONFLICT (order_id) DO NOTHING;
    INSERT INTO public.order_events (order_id, merchant_id, event_type, channel, details)
    VALUES (NEW.id, NEW.merchant_id, 'REFUND_REQUIRED', 'system',
            jsonb_build_object('amount_kes', NEW.total_kes, 'payment_method', NEW.payment_method));
  END IF;

  INSERT INTO public.customer_notifications (order_id, customer_id, phone, kind, details, status)
  VALUES (
    NEW.id, NEW.customer_id, msisdn,
    CASE WHEN NEW.merchant_response = 'declined' THEN 'order_declined' ELSE 'order_expired' END,
    jsonb_build_object(
      'merchant_name', NEW.merchant_name,
      'total_kes', NEW.total_kes,
      'payment_method', NEW.payment_method,
      'refund_due', refund_due
    ),
    CASE WHEN msisdn IS NULL THEN 'skipped' ELSE 'queued' END
  )
  ON CONFLICT (order_id, kind) DO NOTHING;
  RETURN NULL;
END $$;
CREATE TRIGGER orders_queue_customer_followups AFTER UPDATE OF merchant_response ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_queue_customer_followups();

-- 5. Private wake-up call to the app's message sender (token and URL live in Vault).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'beez_followups_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'beez_followups_token',
      'Shared token for the Beez order follow-ups wake-up call');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'beez_app_url') THEN
    PERFORM vault.create_secret('https://project--0911b9a7-8691-43ff-ae9d-7192249fbbc6.lovable.app', 'beez_app_url',
      'Public Beez app URL used for server callbacks');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.wake_order_followups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  base_url text;
  token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM inserted_rows WHERE status = 'queued') THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'beez_app_url';
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name = 'beez_followups_token';
  IF base_url IS NULL OR token IS NULL THEN RETURN NULL; END IF;
  PERFORM net.http_post(
    url := rtrim(base_url, '/') || '/api/public/order-followups',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-beez-followups-token', token),
    timeout_milliseconds := 10000
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'wake_order_followups failed: %', SQLERRM;
  RETURN NULL;
END $$;
CREATE TRIGGER customer_notifications_wake AFTER INSERT ON public.customer_notifications
  REFERENCING NEW TABLE AS inserted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.wake_order_followups();

CREATE OR REPLACE FUNCTION public.verify_followups_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(length(_token) >= 32, false) AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'beez_followups_token' AND decrypted_secret = _token
  )
$$;

-- 6. Message sender helpers (server only).
CREATE OR REPLACE FUNCTION public.claim_customer_notifications(_limit integer DEFAULT 20)
RETURNS SETOF public.customer_notifications LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.customer_notifications AS n
  SET status = 'sending', attempts = n.attempts + 1, updated_at = now()
  WHERE n.id IN (
    SELECT c.id FROM public.customer_notifications AS c
    WHERE (c.status = 'queued' AND c.next_attempt_at <= now())
       OR (c.status = 'sending' AND c.updated_at < now() - interval '5 minutes' AND c.attempts < 3)
    ORDER BY c.created_at
    LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING n.*;
$$;

CREATE OR REPLACE FUNCTION public.finish_customer_notification(
  _id uuid, _ok boolean, _error text DEFAULT NULL, _provider_message_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n public.customer_notifications;
BEGIN
  SELECT * INTO n FROM public.customer_notifications WHERE id = _id AND status = 'sending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF _ok THEN
    UPDATE public.customer_notifications
    SET status = 'sent', sent_at = now(), last_error = NULL, provider_message_id = left(_provider_message_id, 120)
    WHERE id = _id;
  ELSE
    UPDATE public.customer_notifications
    SET status = CASE WHEN n.attempts >= 3 THEN 'failed' ELSE 'queued' END,
        next_attempt_at = now() + make_interval(mins => power(2, n.attempts)::integer),
        last_error = left(COALESCE(_error, 'Unknown error'), 300)
    WHERE id = _id;
  END IF;
  INSERT INTO public.order_events (order_id, event_type, channel, details)
  VALUES (n.order_id, CASE WHEN _ok THEN 'CUSTOMER_SMS_SENT' ELSE 'CUSTOMER_SMS_FAILED' END, 'system',
          jsonb_build_object('kind', n.kind, 'attempt', n.attempts, 'error', left(_error, 300)));
END $$;

-- 7. Refund completion (internal) and admin/server actions.
CREATE OR REPLACE FUNCTION public.complete_order_refund_internal(_refund_id uuid, _method text, _reference text, _actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.order_refunds; o public.orders;
BEGIN
  UPDATE public.order_refunds
  SET status = 'refunded', method = _method, mpesa_reference = _reference, failure_reason = NULL,
      handled_by = COALESCE(_actor, handled_by), processed_at = now()
  WHERE id = _refund_id
  RETURNING * INTO r;
  UPDATE public.orders SET payment_status = 'Refunded', updated_at = now()
  WHERE id = r.order_id AND payment_status = 'Refund Pending'
  RETURNING * INTO o;
  INSERT INTO public.order_events (order_id, merchant_id, actor_id, event_type, channel, details)
  VALUES (r.order_id, o.merchant_id, _actor, 'REFUND_SENT', 'system',
          jsonb_build_object('amount_kes', r.amount_kes, 'method', _method, 'reference', _reference));
  INSERT INTO public.customer_notifications (order_id, customer_id, phone, kind, details, status)
  VALUES (r.order_id, r.customer_id, r.destination_phone, 'refund_sent',
          jsonb_build_object('total_kes', r.amount_kes, 'reference', _reference,
                             'merchant_name', COALESCE(o.merchant_name, '')),
          CASE WHEN r.destination_phone IS NULL THEN 'skipped' ELSE 'queued' END)
  ON CONFLICT (order_id, kind) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_record_manual_refund(_refund_id uuid, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ref text := upper(btrim(COALESCE(_reference, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can record refunds';
  END IF;
  IF ref !~ '^[A-Z0-9]{8,12}$' THEN
    RAISE EXCEPTION 'Enter the M-Pesa transaction code (8-12 letters and numbers)';
  END IF;
  PERFORM 1 FROM public.order_refunds
  WHERE id = _refund_id AND status IN ('pending', 'failed', 'review') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This refund cannot be recorded now'; END IF;
  PERFORM public.complete_order_refund_internal(_refund_id, 'manual', ref, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_refund(_refund_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.order_refunds; note text := left(btrim(COALESCE(_note, '')), 300);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change refunds';
  END IF;
  IF note = '' THEN RAISE EXCEPTION 'Add a note explaining why no refund is due'; END IF;
  UPDATE public.order_refunds
  SET status = 'rejected', admin_note = note, handled_by = auth.uid(), processed_at = now()
  WHERE id = _refund_id AND status IN ('pending', 'failed', 'review')
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'This refund cannot be changed now'; END IF;
  UPDATE public.orders SET payment_status = 'Unpaid', updated_at = now()
  WHERE id = r.order_id AND payment_status = 'Refund Pending';
  INSERT INTO public.order_events (order_id, actor_id, event_type, channel, details)
  VALUES (r.order_id, auth.uid(), 'REFUND_REJECTED', 'system', jsonb_build_object('note', note));
END $$;

CREATE OR REPLACE FUNCTION public.admin_begin_refund_payout(_refund_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.order_refunds;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can send refunds';
  END IF;
  UPDATE public.order_refunds
  SET status = 'processing', method = 'mpesa', failure_reason = NULL, handled_by = auth.uid(),
      provider_conversation_id = NULL, provider_originator_conversation_id = NULL
  WHERE id = _refund_id AND status IN ('pending', 'failed') AND destination_phone IS NOT NULL
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This refund cannot be sent by M-Pesa now (already handled, or no M-Pesa number)';
  END IF;
  INSERT INTO public.order_events (order_id, actor_id, event_type, channel, details)
  VALUES (r.order_id, auth.uid(), 'REFUND_APPROVED', 'system', jsonb_build_object('amount_kes', r.amount_kes));
  RETURN jsonb_build_object('id', r.id, 'order_id', r.order_id, 'amount_kes', r.amount_kes, 'phone', r.destination_phone);
END $$;

CREATE OR REPLACE FUNCTION public.service_update_refund_payout(
  _refund_id uuid, _outcome text, _conversation_id text DEFAULT NULL,
  _originator_id text DEFAULT NULL, _reference text DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _outcome = 'submitted' THEN
    UPDATE public.order_refunds
    SET provider_conversation_id = _conversation_id, provider_originator_conversation_id = _originator_id
    WHERE id = _refund_id AND status = 'processing';
  ELSIF _outcome = 'success' THEN
    PERFORM 1 FROM public.order_refunds WHERE id = _refund_id AND status IN ('processing', 'review') FOR UPDATE;
    IF FOUND THEN
      PERFORM public.complete_order_refund_internal(_refund_id, 'mpesa', upper(left(_reference, 20)), NULL);
    END IF;
  ELSIF _outcome IN ('failed', 'review') THEN
    UPDATE public.order_refunds
    SET status = _outcome, failure_reason = left(COALESCE(_reason, 'M-Pesa did not confirm the refund'), 300)
    WHERE id = _refund_id AND status = 'processing';
  ELSE
    RAISE EXCEPTION 'Invalid refund outcome';
  END IF;
END $$;

-- 8. Who may call what.
REVOKE ALL ON FUNCTION public.orders_mark_refund_due() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_queue_customer_followups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wake_order_followups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_order_refund_internal(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_followups_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_customer_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_customer_notification(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_update_refund_payout(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_followups_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_customer_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_customer_notification(uuid, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_update_refund_payout(uuid, text, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_record_manual_refund(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_refund(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_begin_refund_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_manual_refund(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_refund(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_begin_refund_payout(uuid) TO authenticated;