CREATE TABLE public.rider_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  amount_kes integer NOT NULL CHECK (amount_kes > 0 AND amount_kes <= 250000),
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  destination_phone text NOT NULL,
  status text NOT NULL DEFAULT 'Requested'
    CHECK (status IN ('Requested', 'Processing', 'Review', 'Paid', 'Failed')),
  provider text NOT NULL DEFAULT 'M-Pesa' CHECK (provider = 'M-Pesa'),
  idempotency_key uuid NOT NULL,
  provider_conversation_id text,
  provider_originator_conversation_id text,
  provider_transaction_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT rider_payout_requests_idempotency_unique UNIQUE (rider_id, idempotency_key),
  CONSTRAINT rider_payout_requests_conversation_unique UNIQUE (provider_conversation_id),
  CONSTRAINT rider_payout_requests_originator_unique UNIQUE (provider_originator_conversation_id),
  CONSTRAINT rider_payout_requests_transaction_unique UNIQUE (provider_transaction_id)
);

CREATE INDEX rider_payout_requests_rider_created_idx
  ON public.rider_payout_requests (rider_id, created_at DESC);
CREATE INDEX rider_payout_requests_reserved_idx
  ON public.rider_payout_requests (rider_id, status)
  WHERE status IN ('Requested', 'Processing', 'Review', 'Paid');

ALTER TABLE public.rider_payout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rider_payout_requests FROM PUBLIC, anon;
GRANT SELECT ON public.rider_payout_requests TO authenticated;
GRANT ALL ON public.rider_payout_requests TO service_role;

CREATE POLICY "Riders view own payout requests"
  ON public.rider_payout_requests FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rider_request_mpesa_payout(
  _amount_kes integer,
  _idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_rider public.riders;
  normalized_phone text;
  existing_request public.rider_payout_requests;
  earned_amount bigint;
  reserved_amount bigint;
  request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a payout';
  END IF;
  IF _amount_kes IS NULL OR _amount_kes < 1 OR _amount_kes > 250000 OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Enter a payout amount between KES 1 and KES 250,000';
  END IF;

  SELECT * INTO current_rider
  FROM public.riders
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create your rider profile before requesting a payout';
  END IF;

  SELECT * INTO existing_request
  FROM public.rider_payout_requests
  WHERE rider_id = auth.uid()
    AND idempotency_key = _idempotency_key;

  IF FOUND THEN
    IF existing_request.amount_kes <> _amount_kes THEN
      RAISE EXCEPTION 'This payout request key has already been used';
    END IF;
    RETURN existing_request.id;
  END IF;

  normalized_phone := regexp_replace(current_rider.phone, '\D', '', 'g');
  IF length(normalized_phone) = 10 AND normalized_phone LIKE '0%' THEN
    normalized_phone := '254' || substr(normalized_phone, 2);
  ELSIF length(normalized_phone) = 9 AND (normalized_phone LIKE '7%' OR normalized_phone LIKE '1%') THEN
    normalized_phone := '254' || normalized_phone;
  END IF;
  IF length(normalized_phone) <> 12 OR normalized_phone NOT LIKE '254%' THEN
    RAISE EXCEPTION 'Update your rider profile with a valid Kenyan M-Pesa phone number';
  END IF;

  SELECT COALESCE(SUM(rider_earning_kes), 0)
  INTO earned_amount
  FROM public.orders
  WHERE rider_id = auth.uid()
    AND status = 'Delivered';

  SELECT COALESCE(SUM(amount_kes), 0)
  INTO reserved_amount
  FROM public.rider_payout_requests
  WHERE rider_id = auth.uid()
    AND status IN ('Requested', 'Processing', 'Review', 'Paid');

  IF _amount_kes > GREATEST(earned_amount - reserved_amount, 0) THEN
    RAISE EXCEPTION 'Payout amount exceeds your available earnings';
  END IF;

  INSERT INTO public.rider_payout_requests (
    rider_id,
    amount_kes,
    destination_phone,
    idempotency_key
  )
  VALUES (
    auth.uid(),
    _amount_kes,
    normalized_phone,
    _idempotency_key
  )
  RETURNING id INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rider_request_mpesa_payout(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_request_mpesa_payout(integer, uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rider_payout_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_payout_requests;
  END IF;
END $$;
