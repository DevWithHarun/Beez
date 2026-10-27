ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'merchant-images',
  'merchant-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Merchants upload own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'merchant-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );

CREATE POLICY "Merchants update own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'merchant-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(name))[1]
        AND merchant.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'merchant-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );

CREATE POLICY "Merchants delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'merchant-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );
