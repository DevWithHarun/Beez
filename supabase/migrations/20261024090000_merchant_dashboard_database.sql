CREATE TABLE IF NOT EXISTS public.merchant_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount_kes integer NOT NULL CHECK (amount_kes > 0),
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  status text NOT NULL DEFAULT 'Requested'
    CHECK (status IN ('Requested', 'Processing', 'Paid', 'Failed', 'Cancelled')),
  provider text,
  provider_reference text,
  idempotency_key uuid NOT NULL UNIQUE,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE OR REPLACE FUNCTION public.merchant_dashboard_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchant_payout_requests_touch
  BEFORE UPDATE ON public.merchant_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();
REVOKE ALL ON FUNCTION public.merchant_dashboard_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS merchant_payout_requests_merchant_created_idx
  ON public.merchant_payout_requests (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_payout_requests_reserved_idx
  ON public.merchant_payout_requests (merchant_id, status)
  WHERE status IN ('Requested', 'Processing', 'Paid');

ALTER TABLE public.merchant_payout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_payout_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.merchant_payout_requests TO authenticated;
GRANT ALL ON public.merchant_payout_requests TO service_role;

CREATE POLICY "Merchants view own payout requests"
  ON public.merchant_payout_requests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.merchants AS m
    WHERE m.id = merchant_payout_requests.merchant_id
      AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins manage merchant payout requests"
  ON public.merchant_payout_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.merchant_request_payout(
  _amount_kes integer,
  _idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_merchant_id uuid;
  existing_merchant_id uuid;
  existing_amount integer;
  existing_request_id uuid;
  paid_earnings bigint;
  reserved_amount bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a payout';
  END IF;
  IF _amount_kes IS NULL OR _amount_kes <= 0 OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A positive payout amount and request key are required';
  END IF;

  SELECT m.id INTO target_merchant_id
  FROM public.merchants AS m
  WHERE m.owner_id = auth.uid()
  FOR UPDATE;

  IF target_merchant_id IS NULL THEN
    RAISE EXCEPTION 'No merchant business is linked to this account';
  END IF;

  SELECT p.id, p.merchant_id, p.amount_kes
  INTO existing_request_id, existing_merchant_id, existing_amount
  FROM public.merchant_payout_requests AS p
  WHERE p.idempotency_key = _idempotency_key;

  IF existing_request_id IS NOT NULL THEN
    IF existing_merchant_id <> target_merchant_id OR existing_amount <> _amount_kes THEN
      RAISE EXCEPTION 'This request key has already been used';
    END IF;
    RETURN existing_request_id;
  END IF;

  SELECT COALESCE(SUM(GREATEST(
    o.total_kes - o.delivery_fee_kes - o.service_fee_kes,
    0
  )), 0)
  INTO paid_earnings
  FROM public.orders AS o
  WHERE o.merchant_id = target_merchant_id
    AND o.status = 'Delivered'
    AND o.payment_status = 'Paid';

  SELECT COALESCE(SUM(p.amount_kes), 0)
  INTO reserved_amount
  FROM public.merchant_payout_requests AS p
  WHERE p.merchant_id = target_merchant_id
    AND p.status IN ('Requested', 'Processing', 'Paid');

  IF _amount_kes > GREATEST(paid_earnings - reserved_amount, 0) THEN
    RAISE EXCEPTION 'Payout amount exceeds your available balance';
  END IF;

  INSERT INTO public.merchant_payout_requests (
    merchant_id,
    amount_kes,
    idempotency_key
  )
  VALUES (
    target_merchant_id,
    _amount_kes,
    _idempotency_key
  )
  RETURNING id INTO existing_request_id;

  RETURN existing_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_request_payout(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_request_payout(integer, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.merchant_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  code text NOT NULL
    CHECK (code = upper(btrim(code)) AND code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (
    discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)
  ),
  minimum_order_kes integer NOT NULL DEFAULT 0 CHECK (minimum_order_kes >= 0),
  maximum_discount_kes integer CHECK (maximum_discount_kes IS NULL OR maximum_discount_kes > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_campaigns_valid_dates CHECK (ends_at > starts_at),
  CONSTRAINT merchant_campaigns_id_merchant_unique UNIQUE (id, merchant_id)
);

CREATE TRIGGER merchant_campaigns_touch
  BEFORE UPDATE ON public.merchant_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.merchant_dashboard_touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS merchant_campaigns_code_unique
  ON public.merchant_campaigns (upper(code));
CREATE INDEX IF NOT EXISTS merchant_campaigns_merchant_created_idx
  ON public.merchant_campaigns (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_campaigns_active_dates_idx
  ON public.merchant_campaigns (active, starts_at, ends_at)
  WHERE active;

ALTER TABLE public.merchant_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_campaigns FROM PUBLIC;
GRANT SELECT ON public.merchant_campaigns TO anon, authenticated;
GRANT INSERT, UPDATE ON public.merchant_campaigns TO authenticated;
GRANT ALL ON public.merchant_campaigns TO service_role;

CREATE POLICY "Anyone can view currently active campaigns"
  ON public.merchant_campaigns FOR SELECT TO anon, authenticated
  USING (active AND starts_at <= now() AND ends_at > now());
CREATE POLICY "Merchants manage own campaigns"
  ON public.merchant_campaigns FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.merchants AS m
    WHERE m.id = merchant_campaigns.merchant_id
      AND m.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.merchants AS m
    WHERE m.id = merchant_campaigns.merchant_id
      AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins manage merchant campaigns"
  ON public.merchant_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS discount_kes integer NOT NULL DEFAULT 0
    CHECK (discount_kes >= 0);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_campaign_merchant_fkey
  FOREIGN KEY (campaign_id, merchant_id)
  REFERENCES public.merchant_campaigns (id, merchant_id);

CREATE INDEX IF NOT EXISTS orders_campaign_idx
  ON public.orders (campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_order_created_idx
  ON public.order_items (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_merchant_active_created_idx
  ON public.products (merchant_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_campaign_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  order_id text NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  discount_kes integer NOT NULL CHECK (discount_kes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_campaign_redemptions_campaign_merchant_fkey
    FOREIGN KEY (campaign_id, merchant_id)
    REFERENCES public.merchant_campaigns (id, merchant_id)
);

CREATE INDEX IF NOT EXISTS merchant_campaign_redemptions_campaign_created_idx
  ON public.merchant_campaign_redemptions (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_campaign_redemptions_merchant_created_idx
  ON public.merchant_campaign_redemptions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_campaign_redemptions_customer_idx
  ON public.merchant_campaign_redemptions (campaign_id, customer_id)
  WHERE customer_id IS NOT NULL;

ALTER TABLE public.merchant_campaign_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_campaign_redemptions FROM PUBLIC, anon;
GRANT SELECT ON public.merchant_campaign_redemptions TO authenticated;
GRANT ALL ON public.merchant_campaign_redemptions TO service_role;

CREATE POLICY "Merchants view own campaign redemptions"
  ON public.merchant_campaign_redemptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.merchants AS m
    WHERE m.id = merchant_campaign_redemptions.merchant_id
      AND m.owner_id = auth.uid()
  ));
CREATE POLICY "Admins manage campaign redemptions"
  ON public.merchant_campaign_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
