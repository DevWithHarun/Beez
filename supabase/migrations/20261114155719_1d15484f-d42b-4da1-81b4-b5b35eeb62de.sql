ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text CHECK (description IS NULL OR char_length(description) <= 600),
  ADD COLUMN IF NOT EXISTS image_media_id uuid,
  ADD COLUMN IF NOT EXISTS image_origin text CHECK (image_origin IS NULL OR image_origin IN ('photo', 'ai_enhanced', 'ai_presentation'));

CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  source_media_id uuid REFERENCES public.product_media(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('original', 'enhanced', 'studio', 'promotional')),
  origin text NOT NULL CHECK (origin IN ('photo', 'ai_enhanced', 'ai_presentation')),
  storage_path text NOT NULL UNIQUE CHECK (char_length(storage_path) <= 300),
  public_url text NOT NULL CHECK (char_length(public_url) <= 600),
  instruction text CHECK (instruction IS NULL OR char_length(instruction) <= 300),
  model text CHECK (model IS NULL OR char_length(model) <= 80),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'superseded')),
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'original') = (source_media_id IS NULL)),
  CHECK (kind <> 'original' OR origin = 'photo'),
  CHECK (kind NOT IN ('enhanced', 'studio') OR origin = 'ai_enhanced'),
  CHECK (kind <> 'promotional' OR origin = 'ai_presentation')
);
GRANT SELECT, INSERT ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own product media" ON public.product_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = product_media.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Merchants add own draft product media" ON public.product_media FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft' AND product_id IS NULL AND approved_at IS NULL AND approved_by IS NULL
    AND created_by = auth.uid() AND split_part(storage_path, '/', 1) = merchant_id::text
    AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = product_media.merchant_id AND m.owner_id = auth.uid())
    AND (source_media_id IS NULL OR EXISTS (
      SELECT 1 FROM public.product_media src WHERE src.id = product_media.source_media_id
        AND src.merchant_id = product_media.merchant_id AND src.kind = 'original'
    ))
  );
CREATE POLICY "Admins view product media" ON public.product_media FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.product_media_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.product_media(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL CHECK (action IN ('uploaded', 'analysed', 'enhanced', 'generated', 'approved', 'superseded')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.product_media_events TO authenticated;
GRANT ALL ON public.product_media_events TO service_role;
ALTER TABLE public.product_media_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own product media history" ON public.product_media_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = product_media_events.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Merchants record own product media history" ON public.product_media_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid() AND action IN ('uploaded', 'analysed', 'enhanced', 'generated')
    AND EXISTS (
      SELECT 1 FROM public.product_media pm JOIN public.merchants m ON m.id = pm.merchant_id
      WHERE pm.id = product_media_events.media_id AND pm.merchant_id = product_media_events.merchant_id
        AND m.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins view product media history" ON public.product_media_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.photo_studio_request_windows (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
REVOKE ALL ON TABLE public.photo_studio_request_windows FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.photo_studio_request_windows TO service_role;
ALTER TABLE public.photo_studio_request_windows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_media_merchant_idx ON public.product_media (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_media_product_idx ON public.product_media (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_media_url_idx ON public.product_media (merchant_id, public_url);
CREATE INDEX IF NOT EXISTS product_media_events_media_idx ON public.product_media_events (media_id, created_at);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_media_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_image_media_id_fkey
  FOREIGN KEY (image_media_id) REFERENCES public.product_media(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.products_sync_image_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE media record;
BEGIN
  IF NEW.image_url IS NULL THEN NEW.image_media_id := NULL; NEW.image_origin := NULL; RETURN NEW; END IF;
  SELECT pm.id, pm.origin INTO media FROM public.product_media pm
  WHERE pm.merchant_id = NEW.merchant_id AND pm.public_url = NEW.image_url
  ORDER BY pm.created_at DESC LIMIT 1;
  IF FOUND THEN NEW.image_media_id := media.id; NEW.image_origin := media.origin;
  ELSE NEW.image_media_id := NULL; NEW.image_origin := 'photo'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.products_sync_image_media() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS products_sync_image_media ON public.products;
CREATE TRIGGER products_sync_image_media BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sync_image_media();

CREATE OR REPLACE FUNCTION public.approve_product_media(_media_id uuid, _product_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE media public.product_media%ROWTYPE; root_id uuid;
BEGIN
  SELECT pm.* INTO media FROM public.product_media pm JOIN public.merchants m ON m.id = pm.merchant_id
  WHERE pm.id = _media_id AND m.owner_id = auth.uid() FOR UPDATE OF pm;
  IF NOT FOUND THEN RAISE EXCEPTION 'This image could not be found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id AND p.merchant_id = media.merchant_id) THEN
    RAISE EXCEPTION 'This product could not be found.' USING ERRCODE = 'P0002';
  END IF;
  root_id := coalesce(media.source_media_id, media.id);
  UPDATE public.product_media SET status = 'superseded' WHERE product_id = _product_id AND status = 'approved' AND id <> media.id;
  UPDATE public.product_media SET status = 'approved', product_id = _product_id, approved_at = now(), approved_by = auth.uid() WHERE id = media.id;
  UPDATE public.product_media SET product_id = _product_id WHERE (id = root_id OR source_media_id = root_id) AND product_id IS NULL;
  UPDATE public.products SET image_url = media.public_url WHERE id = _product_id;
  INSERT INTO public.product_media_events (media_id, merchant_id, actor_id, action, details)
  VALUES (media.id, media.merchant_id, auth.uid(), 'approved', jsonb_build_object('product_id', _product_id, 'kind', media.kind, 'origin', media.origin));
  RETURN media.public_url;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_product_media(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_product_media(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_photo_studio_request()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requests_in_window integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  INSERT INTO public.photo_studio_request_windows AS w (user_id, window_started_at, request_count)
  VALUES (auth.uid(), now(), 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE WHEN w.window_started_at <= now() - interval '1 hour' THEN now() ELSE w.window_started_at END,
      request_count = CASE WHEN w.window_started_at <= now() - interval '1 hour' THEN 1 ELSE w.request_count + 1 END
  RETURNING request_count INTO requests_in_window;
  RETURN requests_in_window <= 30;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_photo_studio_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_photo_studio_request() TO authenticated;
UPDATE public.products SET image_origin = 'photo' WHERE image_url IS NOT NULL AND image_origin IS NULL;