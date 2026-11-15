CREATE TABLE public.mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid,
  phone text NOT NULL CHECK (phone ~ '^2547[0-9]{8}$|^2541[0-9]{8}$'),
  amount_kes integer NOT NULL CHECK (amount_kes > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'failed', 'cancelled', 'timeout')),
  merchant_request_id text,
  checkout_request_id text UNIQUE,
  result_code integer,
  result_desc text CHECK (result_desc IS NULL OR char_length(result_desc) <= 300),
  receipt text CHECK (receipt IS NULL OR char_length(receipt) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mpesa_payments TO authenticated;
GRANT ALL ON public.mpesa_payments TO service_role;
ALTER TABLE public.mpesa_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own M-Pesa payments" ON public.mpesa_payments
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins view M-Pesa payments" ON public.mpesa_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX mpesa_payments_order_idx ON public.mpesa_payments (order_id, created_at DESC);
CREATE TRIGGER mpesa_payments_touch BEFORE UPDATE ON public.mpesa_payments
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();

-- Orders are created only by the server after it re-checks prices and stock.
DROP POLICY IF EXISTS "Customers create own orders" ON public.orders;
REVOKE INSERT ON public.orders FROM authenticated, anon;
DROP POLICY IF EXISTS "Customers create own order items" ON public.order_items;

-- Refunds can now also come from a payment that arrived after cancellation.
ALTER TABLE public.order_refunds DROP CONSTRAINT order_refunds_reason_check;
ALTER TABLE public.order_refunds ADD CONSTRAINT order_refunds_reason_check
  CHECK (reason IN ('merchant_declined', 'merchant_no_response', 'paid_after_cancel'));

-- Records Safaricom's answer for one prompt. Server-only.
CREATE OR REPLACE FUNCTION public.service_record_mpesa_result(
  _checkout_request_id text, _result_code integer, _result_desc text DEFAULT NULL, _receipt text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  p public.mpesa_payments%ROWTYPE;
  o public.orders%ROWTYPE;
  next_status text;
BEGIN
  SELECT * INTO p FROM public.mpesa_payments WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;

  IF _result_code = 0 THEN
    IF p.status = 'paid' THEN
      IF p.receipt IS NULL AND _receipt IS NOT NULL THEN
        UPDATE public.mpesa_payments SET receipt = left(_receipt, 40) WHERE id = p.id;
      END IF;
      RETURN 'paid';
    END IF;
    UPDATE public.mpesa_payments
      SET status = 'paid', result_code = 0, result_desc = left(_result_desc, 300), receipt = left(_receipt, 40)
      WHERE id = p.id;
    SELECT * INTO o FROM public.orders WHERE id = p.order_id FOR UPDATE;
    IF o.status = 'Cancelled' THEN
      UPDATE public.orders SET payment_method = 'M-Pesa', payment_status = 'Refund Pending', updated_at = now()
        WHERE id = o.id AND payment_status IN ('Unpaid', 'Paid');
      INSERT INTO public.order_refunds (order_id, customer_id, destination_phone, amount_kes, reason)
        VALUES (o.id, o.customer_id, p.phone, p.amount_kes, 'paid_after_cancel')
        ON CONFLICT (order_id) DO NOTHING;
    ELSIF o.payment_status = 'Unpaid' THEN
      UPDATE public.orders SET payment_method = 'M-Pesa', payment_status = 'Paid', updated_at = now() WHERE id = o.id;
    END IF;
    INSERT INTO public.order_events (order_id, merchant_id, event_type, channel, details)
      VALUES (o.id, o.merchant_id, 'PAYMENT_RECEIVED', 'system',
              jsonb_build_object('amount_kes', p.amount_kes, 'receipt', _receipt));
    RETURN 'paid';
  END IF;

  IF p.status <> 'requested' THEN RETURN p.status; END IF;
  next_status := CASE _result_code WHEN 1032 THEN 'cancelled' WHEN 1037 THEN 'timeout' ELSE 'failed' END;
  UPDATE public.mpesa_payments
    SET status = next_status, result_code = _result_code, result_desc = left(_result_desc, 300)
    WHERE id = p.id;
  RETURN next_status;
END $$;
REVOKE ALL ON FUNCTION public.service_record_mpesa_result(text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_record_mpesa_result(text, integer, text, text) TO service_role;

-- Shopper switches an unpaid M-Pesa order to cash.
CREATE OR REPLACE FUNCTION public.customer_pay_cash_instead(_order_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = '42501';
  END IF;
  IF o.payment_method <> 'M-Pesa' OR o.payment_status <> 'Unpaid' THEN
    RAISE EXCEPTION 'This order is already paid or set to cash' USING ERRCODE = '22023';
  END IF;
  IF o.status IN ('Cancelled', 'Delivered') THEN
    RAISE EXCEPTION 'This order is closed' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mpesa_payments
             WHERE order_id = o.id AND status = 'requested' AND created_at > now() - interval '3 minutes') THEN
    RAISE EXCEPTION 'An M-Pesa prompt is still waiting on your phone' USING ERRCODE = '22023';
  END IF;
  UPDATE public.orders SET payment_method = 'Cash on Delivery', updated_at = now() WHERE id = o.id;
END $$;
REVOKE ALL ON FUNCTION public.customer_pay_cash_instead(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_pay_cash_instead(text) TO authenticated;