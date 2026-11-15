-- Customer cart
CREATE TABLE public.customer_cart_items (
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_kes integer NOT NULL CHECK (unit_price_kes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_cart_items TO authenticated;
GRANT ALL ON public.customer_cart_items TO service_role;
ALTER TABLE public.customer_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage their own cart"
  ON public.customer_cart_items FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

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

-- Order status timeline
CREATE TABLE public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_events_order_id_created_at_idx
  ON public.order_status_events (order_id, created_at);
GRANT SELECT ON public.order_status_events TO anon, authenticated;
GRANT ALL ON public.order_status_events TO service_role;
ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view order status events"
  ON public.order_status_events FOR SELECT USING (true);

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

-- Product Reel and merchant intro videos: shop fields
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_thumb_url text,
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS video_thumb_path text,
  ADD COLUMN IF NOT EXISTS video_duration numeric(5,2),
  ADD COLUMN IF NOT EXISTS video_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS video_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_updated_at timestamptz;

ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_video_status_check;
ALTER TABLE public.merchants ADD CONSTRAINT merchants_video_status_check
  CHECK (video_status IN ('none', 'uploading', 'processing', 'ready', 'failed'));
ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_video_review_status_check;
ALTER TABLE public.merchants ADD CONSTRAINT merchants_video_review_status_check
  CHECK (video_review_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS clip_url text,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';

-- Slugs
CREATE OR REPLACE FUNCTION public.merchant_slug_base(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(left(trim(both '-' from regexp_replace(lower(coalesce(_name, '')), '[^a-z0-9]+', '-', 'g')), 48), ''),
    'shop'
  );
$$;

CREATE OR REPLACE FUNCTION public.unique_merchant_slug(_name text, _id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text := public.merchant_slug_base(_name);
  candidate text := base;
  n integer := 0;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.merchants WHERE slug = candidate AND id <> _id) LOOP
    n := n + 1;
    candidate := base || '-' || substr(md5(_id::text || n::text), 1, 4);
  END LOOP;
  RETURN candidate;
END;
$$;

WITH ranked AS (
  SELECT id, public.merchant_slug_base(name) AS base,
         row_number() OVER (PARTITION BY public.merchant_slug_base(name) ORDER BY created_at, id) AS rn
  FROM public.merchants
  WHERE slug IS NULL
)
UPDATE public.merchants m
SET slug = CASE WHEN r.rn = 1 AND NOT EXISTS (SELECT 1 FROM public.merchants x WHERE x.slug = r.base)
                THEN r.base
                ELSE r.base || '-' || substr(md5(m.id::text), 1, 4) END
FROM ranked r
WHERE r.id = m.id;

CREATE UNIQUE INDEX IF NOT EXISTS merchants_slug_key ON public.merchants (slug);

-- Guard: slugs and video fields only change through the functions below
CREATE OR REPLACE FUNCTION public.merchants_guard_reel_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged boolean :=
    coalesce(current_setting('beez.merchant_video_write', true), '') = 'on'
    OR auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT privileged THEN
      NEW.slug := NULL;
      NEW.video_url := NULL; NEW.video_thumb_url := NULL;
      NEW.video_path := NULL; NEW.video_thumb_path := NULL;
      NEW.video_duration := NULL; NEW.video_size_bytes := NULL;
      NEW.video_status := 'none'; NEW.video_review_status := 'none';
      NEW.video_updated_at := NULL;
    END IF;
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
      NEW.slug := public.unique_merchant_slug(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NOT privileged AND (
    NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.video_url IS DISTINCT FROM OLD.video_url
    OR NEW.video_thumb_url IS DISTINCT FROM OLD.video_thumb_url
    OR NEW.video_path IS DISTINCT FROM OLD.video_path
    OR NEW.video_thumb_path IS DISTINCT FROM OLD.video_thumb_path
    OR NEW.video_duration IS DISTINCT FROM OLD.video_duration
    OR NEW.video_size_bytes IS DISTINCT FROM OLD.video_size_bytes
    OR NEW.video_status IS DISTINCT FROM OLD.video_status
    OR NEW.video_review_status IS DISTINCT FROM OLD.video_review_status
    OR NEW.video_updated_at IS DISTINCT FROM OLD.video_updated_at
  ) THEN
    RAISE EXCEPTION 'Shop link and video details can only be changed from the video page';
  END IF;
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := coalesce(OLD.slug, public.unique_merchant_slug(NEW.name, NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.merchants_guard_reel_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS merchants_guard_reel_fields ON public.merchants;
CREATE TRIGGER merchants_guard_reel_fields
  BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.merchants_guard_reel_fields();

-- Video storage access rules (bucket itself is created separately)
DROP POLICY IF EXISTS "Merchants read own shop videos" ON storage.objects;
CREATE POLICY "Merchants read own shop videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'videos'
    AND EXISTS (SELECT 1 FROM public.merchants m
                WHERE m.id::text = (storage.foldername(storage.objects.name))[1] AND m.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "Merchants upload own shop videos" ON storage.objects;
CREATE POLICY "Merchants upload own shop videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'videos'
    AND EXISTS (SELECT 1 FROM public.merchants m
                WHERE m.id::text = (storage.foldername(storage.objects.name))[1] AND m.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "Merchants replace own shop videos" ON storage.objects;
CREATE POLICY "Merchants replace own shop videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'videos'
    AND EXISTS (SELECT 1 FROM public.merchants m
                WHERE m.id::text = (storage.foldername(storage.objects.name))[1] AND m.owner_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'videos'
    AND EXISTS (SELECT 1 FROM public.merchants m
                WHERE m.id::text = (storage.foldername(storage.objects.name))[1] AND m.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "Merchants delete own shop videos" ON storage.objects;
CREATE POLICY "Merchants delete own shop videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos'
    AND EXISTS (SELECT 1 FROM public.merchants m
                WHERE m.id::text = (storage.foldername(storage.objects.name))[1] AND m.owner_id = auth.uid())
  );

-- Video functions
CREATE OR REPLACE FUNCTION public.merchant_video_set_status(_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your shop video'; END IF;
  IF _status NOT IN ('uploading', 'processing', 'failed', 'ready') THEN
    RAISE EXCEPTION 'That video status is not allowed';
  END IF;
  PERFORM set_config('beez.merchant_video_write', 'on', true);
  UPDATE public.merchants
  SET video_status = CASE
        WHEN _status = 'ready' AND video_path IS NULL THEN 'none'
        WHEN _status = 'failed' AND video_path IS NOT NULL THEN 'ready'
        ELSE _status END,
      video_updated_at = now()
  WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your business first'; END IF;
  PERFORM set_config('beez.merchant_video_write', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_video_publish(
  _path text,
  _thumb_path text,
  _video_url text,
  _thumb_url text,
  _duration numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  m public.merchants;
  stored_size bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your shop video'; END IF;
  SELECT * INTO m FROM public.merchants WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your business first'; END IF;

  IF _path !~ ('^' || m.id::text || '/intro-[a-z0-9-]+\.(mp4|webm)$') THEN
    RAISE EXCEPTION 'The video file name is not valid';
  END IF;
  IF _thumb_path !~ ('^' || m.id::text || '/intro-[a-z0-9-]+\.jpg$') THEN
    RAISE EXCEPTION 'The video thumbnail name is not valid';
  END IF;
  IF _video_url IS NULL OR right(_video_url, length('/storage/v1/object/public/videos/' || _path)) <> '/storage/v1/object/public/videos/' || _path THEN
    RAISE EXCEPTION 'The video link is not valid';
  END IF;
  IF _thumb_url IS NULL OR right(_thumb_url, length('/storage/v1/object/public/videos/' || _thumb_path)) <> '/storage/v1/object/public/videos/' || _thumb_path THEN
    RAISE EXCEPTION 'The thumbnail link is not valid';
  END IF;
  IF _duration IS NULL OR _duration < 14.5 OR _duration > 31 THEN
    RAISE EXCEPTION 'Videos must be between 15 and 30 seconds';
  END IF;

  SELECT (o.metadata->>'size')::bigint INTO stored_size
  FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _path;
  IF stored_size IS NULL THEN RAISE EXCEPTION 'The video upload did not finish. Please retry.'; END IF;
  IF stored_size > 52428800 THEN RAISE EXCEPTION 'Videos must be 50 MB or smaller'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _thumb_path) THEN
    RAISE EXCEPTION 'The video thumbnail did not upload. Please retry.';
  END IF;

  PERFORM set_config('beez.merchant_video_write', 'on', true);
  UPDATE public.merchants SET
    video_path = _path,
    video_thumb_path = _thumb_path,
    video_url = _video_url,
    video_thumb_url = _thumb_url,
    video_duration = round(least(_duration, 30), 2),
    video_size_bytes = stored_size,
    video_status = 'ready',
    video_review_status = 'pending',
    video_updated_at = now()
  WHERE id = m.id;
  PERFORM set_config('beez.merchant_video_write', '', true);

  RETURN jsonb_build_object(
    'old_path', CASE WHEN m.video_path IS DISTINCT FROM _path THEN m.video_path END,
    'old_thumb_path', CASE WHEN m.video_thumb_path IS DISTINCT FROM _thumb_path THEN m.video_thumb_path END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_video_remove()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.merchants;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your shop video'; END IF;
  SELECT * INTO m FROM public.merchants WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your business first'; END IF;
  PERFORM set_config('beez.merchant_video_write', 'on', true);
  UPDATE public.merchants SET
    video_path = NULL, video_thumb_path = NULL, video_url = NULL, video_thumb_url = NULL,
    video_duration = NULL, video_size_bytes = NULL,
    video_status = 'none', video_review_status = 'none', video_updated_at = now()
  WHERE id = m.id;
  PERFORM set_config('beez.merchant_video_write', '', true);
  RETURN jsonb_build_object('old_path', m.video_path, 'old_thumb_path', m.video_thumb_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_merchant_video(_merchant_id uuid, _decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can review videos'; END IF;
  IF _decision NOT IN ('approved', 'rejected', 'pending') THEN RAISE EXCEPTION 'Unknown review decision'; END IF;
  UPDATE public.merchants SET video_review_status = _decision
  WHERE id = _merchant_id AND video_status = 'ready';
  IF NOT FOUND THEN RAISE EXCEPTION 'This shop has no video to review'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_video_set_status(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_video_publish(text, text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_video_remove() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_merchant_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_video_set_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_video_publish(text, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_video_remove() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_merchant_video(uuid, text) TO authenticated;

-- Reel events
CREATE TABLE IF NOT EXISTS public.reel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid,
  event text NOT NULL CHECK (event IN ('view', 'add', 'share', 'visit_shop', 'intro_view')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.reel_events TO anon, authenticated;
GRANT SELECT ON public.reel_events TO authenticated;
GRANT ALL ON public.reel_events TO service_role;
ALTER TABLE public.reel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visitors log reel events" ON public.reel_events;
CREATE POLICY "Visitors log reel events"
  ON public.reel_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read reel events" ON public.reel_events;
CREATE POLICY "Admins read reel events"
  ON public.reel_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS reel_events_created_idx ON public.reel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS reel_events_product_idx ON public.reel_events (product_id, event);
CREATE INDEX IF NOT EXISTS reel_events_merchant_idx ON public.reel_events (merchant_id, event);

CREATE OR REPLACE FUNCTION public.admin_reel_stats(_days integer DEFAULT 30)
RETURNS TABLE (
  merchant_id uuid, merchant_name text, product_id uuid, product_name text,
  views bigint, adds bigint, shares bigint, shop_visits bigint, intro_views bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can see reel stats'; END IF;
  RETURN QUERY
  SELECT e.merchant_id, m.name, e.product_id, p.name,
    count(*) FILTER (WHERE e.event = 'view'),
    count(*) FILTER (WHERE e.event = 'add'),
    count(*) FILTER (WHERE e.event = 'share'),
    count(*) FILTER (WHERE e.event = 'visit_shop'),
    count(*) FILTER (WHERE e.event = 'intro_view')
  FROM public.reel_events e
  JOIN public.merchants m ON m.id = e.merchant_id
  LEFT JOIN public.products p ON p.id = e.product_id
  WHERE e.created_at >= now() - make_interval(days => greatest(1, least(_days, 365)))
  GROUP BY e.merchant_id, m.name, e.product_id, p.name
  ORDER BY count(*) FILTER (WHERE e.event = 'add') DESC, count(*) DESC
  LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reel_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reel_stats(integer) TO authenticated;