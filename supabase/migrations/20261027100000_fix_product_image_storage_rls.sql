DROP POLICY IF EXISTS "Merchants upload own product images"
  ON storage.objects;
DROP POLICY IF EXISTS "Merchants update own product images"
  ON storage.objects;
DROP POLICY IF EXISTS "Merchants delete own product images"
  ON storage.objects;

CREATE POLICY "Merchants upload own product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(storage.objects.name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );

CREATE POLICY "Merchants update own product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(storage.objects.name))[1]
        AND merchant.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(storage.objects.name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );

CREATE POLICY "Merchants delete own product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id::text = (storage.foldername(storage.objects.name))[1]
        AND merchant.owner_id = auth.uid()
    )
  );
