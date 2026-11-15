CREATE OR REPLACE FUNCTION public.admin_customer_directory(
  _search text,
  _min_orders integer,
  _limit integer,
  _offset integer
)
RETURNS TABLE (
  customer_key text,
  customer_name text,
  customer_phone text,
  area text,
  order_count bigint,
  paid_total_kes bigint,
  last_order_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view the customer directory';
  END IF;

  IF _min_orders IS NULL OR _min_orders NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Invalid customer order filter';
  END IF;

  IF _limit IS NULL OR _limit < 1 OR _limit > 100 OR _offset IS NULL OR _offset < 0 THEN
    RAISE EXCEPTION 'Invalid customer directory page';
  END IF;

  RETURN QUERY
  WITH normalized_orders AS (
    SELECT
      o.*,
      CASE
        WHEN NULLIF(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
          THEN 'phone:' || regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
        ELSE 'order:' || o.id
      END AS guest_key
    FROM public.orders AS o
  ),
  customer_summaries AS (
    SELECT
      n.guest_key,
      (array_agg(NULLIF(BTRIM(n.customer_name), '') ORDER BY n.created_at DESC))[1] AS display_name,
      (array_agg(NULLIF(BTRIM(n.customer_phone), '') ORDER BY n.created_at DESC))[1] AS display_phone,
      (array_agg(NULLIF(BTRIM(n.customer_area), '') ORDER BY n.created_at DESC))[1] AS display_area,
      COUNT(*) AS orders_total,
      COALESCE(SUM(n.total_kes) FILTER (
        WHERE n.payment_status = 'Paid' AND n.status <> 'Cancelled'
      ), 0)::bigint AS paid_total,
      MAX(n.created_at) AS last_order
    FROM normalized_orders AS n
    GROUP BY n.guest_key
    HAVING COUNT(*) >= _min_orders
  ),
  matching_customers AS (
    SELECT s.*
    FROM customer_summaries AS s
    WHERE NULLIF(BTRIM(_search), '') IS NULL
      OR POSITION(
        LOWER(BTRIM(_search)) IN
        LOWER(CONCAT_WS(' ', s.display_name, s.display_phone, s.display_area))
      ) > 0
  ),
  counted_customers AS (
    SELECT m.*, COUNT(*) OVER () AS matching_total
    FROM matching_customers AS m
  )
  SELECT
    c.guest_key,
    COALESCE(c.display_name, 'Guest customer'),
    COALESCE(c.display_phone, ''),
    COALESCE(c.display_area, ''),
    c.orders_total,
    c.paid_total,
    c.last_order,
    c.matching_total
  FROM counted_customers AS c
  ORDER BY c.last_order DESC, c.guest_key
  LIMIT _limit OFFSET _offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_customer_order_history(
  _customer_key text,
  _limit integer,
  _offset integer
)
RETURNS TABLE (
  order_id text,
  merchant_name text,
  items_summary text,
  total_kes integer,
  status text,
  payment_method text,
  payment_status text,
  customer_area text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view customer order history';
  END IF;

  IF _limit IS NULL OR _limit < 1 OR _limit > 100 OR _offset IS NULL OR _offset < 0
     OR NULLIF(_customer_key, '') IS NULL THEN
    RAISE EXCEPTION 'Invalid customer order history request';
  END IF;

  RETURN QUERY
  WITH customer_orders AS (
    SELECT
      o.id,
      o.merchant_name,
      o.items_summary,
      o.total_kes,
      o.status,
      o.payment_method,
      o.payment_status,
      o.customer_area,
      o.created_at
    FROM public.orders AS o
    WHERE CASE
      WHEN NULLIF(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
        THEN 'phone:' || regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
      ELSE 'order:' || o.id
    END = _customer_key
  ),
  counted_orders AS (
    SELECT c.*, COUNT(*) OVER () AS matching_total
    FROM customer_orders AS c
  )
  SELECT
    c.id,
    c.merchant_name,
    c.items_summary,
    c.total_kes,
    c.status,
    c.payment_method,
    c.payment_status,
    c.customer_area,
    c.created_at,
    c.matching_total
  FROM counted_orders AS c
  ORDER BY c.created_at DESC, c.id
  LIMIT _limit OFFSET _offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_customer_directory(text, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_customer_order_history(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_directory(text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_customer_order_history(text, integer, integer) TO authenticated;
