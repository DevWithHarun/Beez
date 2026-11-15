CREATE TABLE public.customer_cart_items (
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_kes integer NOT NULL CHECK (unit_price_kes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);

ALTER TABLE public.customer_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own cart"
  ON public.customer_cart_items FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_cart_items TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_customer_cart(_items jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Cart items must be an array';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_items) AS item(product_id text, quantity integer, unit_price_kes integer)
    WHERE item.product_id IS NULL
      OR item.quantity IS NULL OR item.quantity NOT BETWEEN 1 AND 99
      OR item.unit_price_kes IS NULL OR item.unit_price_kes < 0
  ) THEN
    RAISE EXCEPTION 'Cart item values are invalid';
  END IF;

  DELETE FROM public.customer_cart_items WHERE customer_id = auth.uid();
  INSERT INTO public.customer_cart_items (customer_id, product_id, quantity, unit_price_kes)
  SELECT auth.uid(), item.product_id::uuid, item.quantity, item.unit_price_kes
  FROM jsonb_to_recordset(_items) AS item(product_id text, quantity integer, unit_price_kes integer);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_customer_cart(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_customer_cart(jsonb) TO authenticated;
