-- Product reel videos, pilot review of every merchant video, and reel order/visibility.
-- Customers only ever see videos an admin has approved ("live").

-- 1. Product fields customers read. Set only by the functions below (guard trigger).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS clip_thumb_url text,
  ADD COLUMN IF NOT EXISTS clip_duration numeric(5,2),
  ADD COLUMN IF NOT EXISTS reel_position integer,
  ADD COLUMN IF NOT EXISTS reel_hidden boolean NOT NULL DEFAULT false;

-- 2. Intro video review details on the shop.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS video_reject_reason text,
  ADD COLUMN IF NOT EXISTS video_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS video_reviewed_at timestamptz;

-- 3. The submitted clip for each product (one per product), including ones under review.
CREATE TABLE IF NOT EXISTS public.product_reel_videos (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  video_path text NOT NULL,
  thumb_path text NOT NULL,
  video_url text NOT NULL,
  thumb_url text NOT NULL,
  duration_sec numeric(5,2) NOT NULL,
  size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'live', 'rejected')),
  reject_reason text CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 200),
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_reel_videos TO authenticated;
GRANT ALL ON public.product_reel_videos TO service_role;
ALTER TABLE public.product_reel_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Merchants read own product reel videos" ON public.product_reel_videos;
CREATE POLICY "Merchants read own product reel videos"
  ON public.product_reel_videos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Admins read product reel videos" ON public.product_reel_videos;
CREATE POLICY "Admins read product reel videos"
  ON public.product_reel_videos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS product_reel_videos_queue_idx ON public.product_reel_videos (status, submitted_at);
CREATE INDEX IF NOT EXISTS product_reel_videos_merchant_idx ON public.product_reel_videos (merchant_id);

-- 4. Review history: who approved or rejected what, and when.
CREATE TABLE IF NOT EXISTS public.video_review_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('intro', 'product')),
  decision text NOT NULL CHECK (decision IN ('submitted', 'live', 'rejected')),
  reason text,
  video_path text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_review_log TO authenticated;
GRANT ALL ON public.video_review_log TO service_role;
ALTER TABLE public.video_review_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read video review log" ON public.video_review_log;
CREATE POLICY "Admins read video review log"
  ON public.video_review_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS video_review_log_created_idx ON public.video_review_log (created_at DESC);

-- 5. Guard: reel fields on products change only through these functions (or admins).
CREATE OR REPLACE FUNCTION public.products_guard_reel_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged boolean :=
    coalesce(current_setting('beez.reel_video_write', true), '') = 'on'
    OR auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin');
BEGIN
  IF privileged THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.clip_url := NULL; NEW.clip_thumb_url := NULL; NEW.clip_duration := NULL;
    NEW.reel_position := NULL; NEW.reel_hidden := false;
    RETURN NEW;
  END IF;
  IF NEW.clip_url IS DISTINCT FROM OLD.clip_url
    OR NEW.clip_thumb_url IS DISTINCT FROM OLD.clip_thumb_url
    OR NEW.clip_duration IS DISTINCT FROM OLD.clip_duration
    OR NEW.reel_position IS DISTINCT FROM OLD.reel_position
    OR NEW.reel_hidden IS DISTINCT FROM OLD.reel_hidden THEN
    RAISE EXCEPTION 'Reel videos can only be changed from the Videos page';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.products_guard_reel_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS products_guard_reel_fields ON public.products;
CREATE TRIGGER products_guard_reel_fields
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_guard_reel_fields();

-- Any clip set before review existed is cleared until it goes through review.
UPDATE public.products SET clip_url = NULL
WHERE clip_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.product_reel_videos v WHERE v.product_id = products.id AND v.status = 'live');

-- Copies a clip's customer-facing fields onto the product (only when live).
CREATE OR REPLACE FUNCTION public.sync_product_clip(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.product_reel_videos;
BEGIN
  SELECT * INTO v FROM public.product_reel_videos WHERE product_id = _product_id;
  PERFORM set_config('beez.reel_video_write', 'on', true);
  UPDATE public.products SET
    clip_url = CASE WHEN v.status = 'live' THEN v.video_url END,
    clip_thumb_url = CASE WHEN v.status = 'live' THEN v.thumb_url END,
    clip_duration = CASE WHEN v.status = 'live' THEN v.duration_sec END
  WHERE id = _product_id;
  PERFORM set_config('beez.reel_video_write', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_product_clip(uuid) FROM PUBLIC, anon, authenticated;

-- 6. Merchant: publish a product clip (goes to review).
CREATE OR REPLACE FUNCTION public.merchant_reel_video_publish(
  _product_id uuid, _path text, _thumb_path text, _video_url text, _thumb_url text, _duration numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  m public.merchants;
  old public.product_reel_videos;
  stored_size bigint;
  prefix text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your reel videos'; END IF;
  SELECT * INTO m FROM public.merchants WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your business first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id AND p.merchant_id = m.id) THEN
    RAISE EXCEPTION 'This product is not in your shop';
  END IF;
  prefix := m.id::text || '/products/' || _product_id::text || '-[a-z0-9-]+';
  IF _path !~ ('^' || prefix || '\.(mp4|webm)$') THEN RAISE EXCEPTION 'The video file name is not valid'; END IF;
  IF _thumb_path !~ ('^' || prefix || '\.jpg$') THEN RAISE EXCEPTION 'The video thumbnail name is not valid'; END IF;
  IF _video_url IS NULL OR right(_video_url, length('/storage/v1/object/public/videos/' || _path)) <> '/storage/v1/object/public/videos/' || _path THEN
    RAISE EXCEPTION 'The video link is not valid';
  END IF;
  IF _thumb_url IS NULL OR right(_thumb_url, length('/storage/v1/object/public/videos/' || _thumb_path)) <> '/storage/v1/object/public/videos/' || _thumb_path THEN
    RAISE EXCEPTION 'The thumbnail link is not valid';
  END IF;
  IF _duration IS NULL OR _duration < 7.5 OR _duration > 16 THEN
    RAISE EXCEPTION 'Product videos must be between 8 and 15 seconds';
  END IF;
  SELECT (o.metadata->>'size')::bigint INTO stored_size
  FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _path;
  IF stored_size IS NULL THEN RAISE EXCEPTION 'The video upload did not finish. Please retry.'; END IF;
  IF stored_size > 20971520 THEN RAISE EXCEPTION 'Product videos must be 20 MB or smaller'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _thumb_path) THEN
    RAISE EXCEPTION 'The video thumbnail did not upload. Please retry.';
  END IF;

  SELECT * INTO old FROM public.product_reel_videos WHERE product_id = _product_id;
  INSERT INTO public.product_reel_videos AS v
    (product_id, merchant_id, video_path, thumb_path, video_url, thumb_url, duration_sec, size_bytes, status, submitted_at, updated_at)
  VALUES (_product_id, m.id, _path, _thumb_path, _video_url, _thumb_url, round(least(_duration, 15), 2), stored_size, 'processing', now(), now())
  ON CONFLICT (product_id) DO UPDATE SET
    video_path = EXCLUDED.video_path, thumb_path = EXCLUDED.thumb_path,
    video_url = EXCLUDED.video_url, thumb_url = EXCLUDED.thumb_url,
    duration_sec = EXCLUDED.duration_sec, size_bytes = EXCLUDED.size_bytes,
    status = 'processing', reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL,
    submitted_at = now(), updated_at = now();
  PERFORM public.sync_product_clip(_product_id);
  INSERT INTO public.video_review_log (merchant_id, product_id, kind, decision, video_path, actor_id)
  VALUES (m.id, _product_id, 'product', 'submitted', _path, auth.uid());

  RETURN jsonb_build_object(
    'old_path', CASE WHEN old.video_path IS DISTINCT FROM _path THEN old.video_path END,
    'old_thumb_path', CASE WHEN old.thumb_path IS DISTINCT FROM _thumb_path THEN old.thumb_path END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_reel_video_remove(_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE old public.product_reel_videos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your reel videos'; END IF;
  SELECT v.* INTO old FROM public.product_reel_videos v
  JOIN public.merchants m ON m.id = v.merchant_id AND m.owner_id = auth.uid()
  WHERE v.product_id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This product has no reel video'; END IF;
  DELETE FROM public.product_reel_videos WHERE product_id = _product_id;
  PERFORM public.sync_product_clip(_product_id);
  RETURN jsonb_build_object('old_path', old.video_path, 'old_thumb_path', old.thumb_path);
END;
$$;

-- Hide or show a product in the reel (photo or video).
CREATE OR REPLACE FUNCTION public.merchant_reel_set_hidden(_product_id uuid, _hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your reel'; END IF;
  PERFORM set_config('beez.reel_video_write', 'on', true);
  UPDATE public.products p SET reel_hidden = coalesce(_hidden, false)
  FROM public.merchants m
  WHERE p.id = _product_id AND m.id = p.merchant_id AND m.owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'This product is not in your shop'; END IF;
  PERFORM set_config('beez.reel_video_write', '', true);
END;
$$;

-- Pin order: the given products come first, in this order; the rest lose their position.
CREATE OR REPLACE FUNCTION public.merchant_reel_reorder(_product_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.merchants;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage your reel'; END IF;
  SELECT * INTO m FROM public.merchants WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Set up your business first'; END IF;
  IF coalesce(array_length(_product_ids, 1), 0) > 200 THEN RAISE EXCEPTION 'Too many products to reorder'; END IF;
  PERFORM set_config('beez.reel_video_write', 'on', true);
  UPDATE public.products p SET reel_position = o.ord::integer
  FROM unnest(_product_ids) WITH ORDINALITY AS o(id, ord)
  WHERE p.id = o.id AND p.merchant_id = m.id;
  UPDATE public.products SET reel_position = NULL
  WHERE merchant_id = m.id AND reel_position IS NOT NULL AND NOT (id = ANY (_product_ids));
  PERFORM set_config('beez.reel_video_write', '', true);
END;
$$;

-- 7. Intro: publishing now always sends the video to review and clears an old reason.
CREATE OR REPLACE FUNCTION public.merchant_video_publish(
  _path text, _thumb_path text, _video_url text, _thumb_url text, _duration numeric
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
  IF _path !~ ('^' || m.id::text || '/intro-[a-z0-9-]+\.(mp4|webm)$') THEN RAISE EXCEPTION 'The video file name is not valid'; END IF;
  IF _thumb_path !~ ('^' || m.id::text || '/intro-[a-z0-9-]+\.jpg$') THEN RAISE EXCEPTION 'The video thumbnail name is not valid'; END IF;
  IF _video_url IS NULL OR right(_video_url, length('/storage/v1/object/public/videos/' || _path)) <> '/storage/v1/object/public/videos/' || _path THEN
    RAISE EXCEPTION 'The video link is not valid';
  END IF;
  IF _thumb_url IS NULL OR right(_thumb_url, length('/storage/v1/object/public/videos/' || _thumb_path)) <> '/storage/v1/object/public/videos/' || _thumb_path THEN
    RAISE EXCEPTION 'The thumbnail link is not valid';
  END IF;
  IF _duration IS NULL OR _duration < 14.5 OR _duration > 31 THEN RAISE EXCEPTION 'Videos must be between 15 and 30 seconds'; END IF;
  SELECT (o.metadata->>'size')::bigint INTO stored_size FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _path;
  IF stored_size IS NULL THEN RAISE EXCEPTION 'The video upload did not finish. Please retry.'; END IF;
  IF stored_size > 52428800 THEN RAISE EXCEPTION 'Videos must be 50 MB or smaller'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'videos' AND o.name = _thumb_path) THEN
    RAISE EXCEPTION 'The video thumbnail did not upload. Please retry.';
  END IF;
  PERFORM set_config('beez.merchant_video_write', 'on', true);
  UPDATE public.merchants SET
    video_path = _path, video_thumb_path = _thumb_path, video_url = _video_url, video_thumb_url = _thumb_url,
    video_duration = round(least(_duration, 30), 2), video_size_bytes = stored_size,
    video_status = 'ready', video_review_status = 'pending',
    video_reject_reason = NULL, video_reviewed_by = NULL, video_reviewed_at = NULL,
    video_updated_at = now()
  WHERE id = m.id;
  PERFORM set_config('beez.merchant_video_write', '', true);
  INSERT INTO public.video_review_log (merchant_id, kind, decision, video_path, actor_id)
  VALUES (m.id, 'intro', 'submitted', _path, auth.uid());
  RETURN jsonb_build_object(
    'old_path', CASE WHEN m.video_path IS DISTINCT FROM _path THEN m.video_path END,
    'old_thumb_path', CASE WHEN m.video_thumb_path IS DISTINCT FROM _thumb_path THEN m.video_thumb_path END
  );
END;
$$;

-- The guard must let these new intro review columns through the same way as the others.
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
      NEW.video_reject_reason := NULL; NEW.video_reviewed_by := NULL; NEW.video_reviewed_at := NULL;
      NEW.video_updated_at := NULL;
    END IF;
    IF NEW.slug IS NULL OR NEW.slug = '' THEN NEW.slug := public.unique_merchant_slug(NEW.name, NEW.id); END IF;
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
    OR NEW.video_reject_reason IS DISTINCT FROM OLD.video_reject_reason
    OR NEW.video_reviewed_by IS DISTINCT FROM OLD.video_reviewed_by
    OR NEW.video_reviewed_at IS DISTINCT FROM OLD.video_reviewed_at
    OR NEW.video_updated_at IS DISTINCT FROM OLD.video_updated_at
  ) THEN
    RAISE EXCEPTION 'Shop link and video details can only be changed from the video page';
  END IF;
  IF NEW.slug IS NULL OR NEW.slug = '' THEN NEW.slug := coalesce(OLD.slug, public.unique_merchant_slug(NEW.name, NEW.id)); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.merchants_guard_reel_fields() FROM PUBLIC, anon, authenticated;

-- Removing the intro also clears its review details.
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
    video_status = 'none', video_review_status = 'none',
    video_reject_reason = NULL, video_reviewed_by = NULL, video_reviewed_at = NULL,
    video_updated_at = now()
  WHERE id = m.id;
  PERFORM set_config('beez.merchant_video_write', '', true);
  RETURN jsonb_build_object('old_path', m.video_path, 'old_thumb_path', m.video_thumb_path);
END;
$$;

-- 8. Admin review. Reasons come from a fixed list so merchants get a clear one-liner.
CREATE OR REPLACE FUNCTION public.admin_review_video(_kind text, _target uuid, _decision text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant uuid;
  path text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can review videos'; END IF;
  IF _decision NOT IN ('live', 'rejected') THEN RAISE EXCEPTION 'Unknown review decision'; END IF;
  IF _decision = 'rejected' AND (_reason IS NULL OR _reason NOT IN ('blurry', 'too_dark', 'not_the_product', 'inappropriate', 'wrong_length')) THEN
    RAISE EXCEPTION 'Pick a reason so the merchant knows what to fix';
  END IF;
  IF _kind = 'intro' THEN
    UPDATE public.merchants SET
      video_review_status = CASE WHEN _decision = 'live' THEN 'approved' ELSE 'rejected' END,
      video_reject_reason = CASE WHEN _decision = 'rejected' THEN _reason END,
      video_reviewed_by = auth.uid(), video_reviewed_at = now()
    WHERE id = _target AND video_status = 'ready'
    RETURNING id, video_path INTO merchant, path;
    IF NOT FOUND THEN RAISE EXCEPTION 'This shop has no video to review'; END IF;
  ELSIF _kind = 'product' THEN
    UPDATE public.product_reel_videos SET
      status = _decision,
      reject_reason = CASE WHEN _decision = 'rejected' THEN _reason END,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE product_id = _target
    RETURNING merchant_id, video_path INTO merchant, path;
    IF NOT FOUND THEN RAISE EXCEPTION 'This product has no video to review'; END IF;
    PERFORM public.sync_product_clip(_target);
  ELSE
    RAISE EXCEPTION 'Unknown video type';
  END IF;
  INSERT INTO public.video_review_log (merchant_id, product_id, kind, decision, reason, video_path, actor_id)
  VALUES (merchant, CASE WHEN _kind = 'product' THEN _target END, _kind, _decision, _reason, path, auth.uid());
END;
$$;

-- Approve every video from one shop that is waiting for review.
CREATE OR REPLACE FUNCTION public.admin_approve_shop_videos(_merchant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can review videos'; END IF;
  IF EXISTS (SELECT 1 FROM public.merchants WHERE id = _merchant_id AND video_status = 'ready' AND video_review_status = 'pending') THEN
    PERFORM public.admin_review_video('intro', _merchant_id, 'live', NULL);
    n := n + 1;
  END IF;
  FOR r IN SELECT product_id FROM public.product_reel_videos WHERE merchant_id = _merchant_id AND status = 'processing' LOOP
    PERFORM public.admin_review_video('product', r.product_id, 'live', NULL);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_reel_video_publish(uuid, text, text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_reel_video_remove(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_reel_set_hidden(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_reel_reorder(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_video(text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_approve_shop_videos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_reel_video_publish(uuid, text, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_reel_video_remove(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_reel_set_hidden(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_reel_reorder(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_video(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_shop_videos(uuid) TO authenticated;

-- The old two-way review (approve/hide without a reason) is replaced by admin_review_video.
REVOKE EXECUTE ON FUNCTION public.admin_review_merchant_video(uuid, text) FROM authenticated;