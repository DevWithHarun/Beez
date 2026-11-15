ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_location_coordinates_valid;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_location_coordinates_valid
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );