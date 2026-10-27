CREATE OR REPLACE FUNCTION public.admin_update_order_status(_order_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update order status';
  END IF;

  IF _status IS NULL OR _status NOT IN (
    'Pending',
    'Preparing',
    'Ready for Pickup',
    'Assigned',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
    RAISE EXCEPTION 'Order % was not found', _order_id;
  END IF;

  IF _status = 'Assigned'
     AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND rider_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Assign a rider before marking this order Assigned';
  END IF;

  UPDATE public.orders
  SET status = _status,
      delivered_at = CASE
        WHEN _status = 'Delivered' THEN COALESCE(delivered_at, now())
        ELSE NULL
      END,
      payment_status = CASE
        WHEN _status = 'Delivered' AND payment_method = 'Cash on Delivery' THEN 'Paid'
        ELSE payment_status
      END,
      updated_at = now()
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % was not found', _order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(text, text) TO authenticated;
