ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS owner_id uuid UNIQUE, ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id), ADD COLUMN IF NOT EXISTS customer_id uuid, ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Unpaid';
CREATE INDEX IF NOT EXISTS orders_merchant_idx ON public.orders(merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_kes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Merchants view own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.merchants m ON m.id=o.merchant_id WHERE o.id=order_items.order_id AND m.owner_id=auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.merchants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
CREATE POLICY "Owners view own merchant" ON public.merchants FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners create own merchant" ON public.merchants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own merchant" ON public.merchants FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners view own products" ON public.products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=products.merchant_id AND m.owner_id=auth.uid()));
CREATE POLICY "Owners add own products" ON public.products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=products.merchant_id AND m.owner_id=auth.uid()));
CREATE POLICY "Owners update own products" ON public.products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=products.merchant_id AND m.owner_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=products.merchant_id AND m.owner_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.merchant_prepare_order(_order_id text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _status NOT IN ('Ready for Pickup','Cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.orders o SET status=_status, updated_at=now()
  FROM public.merchants m
  WHERE o.id=_order_id AND m.id=o.merchant_id AND m.owner_id=auth.uid()
    AND o.status IN ('Pending','Preparing') AND o.rider_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order cannot be changed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.merchant_prepare_order(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merchant_prepare_order(text,text) TO authenticated;