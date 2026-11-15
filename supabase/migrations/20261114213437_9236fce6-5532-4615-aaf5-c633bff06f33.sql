ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_instructions text
  CHECK (delivery_instructions IS NULL OR char_length(delivery_instructions) <= 300);