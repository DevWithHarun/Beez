CREATE TABLE public.voice_product_request_windows (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.voice_product_request_windows ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_voice_product_request(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requests_in_window integer;
BEGIN
  INSERT INTO public.voice_product_request_windows AS request_window (
    user_id,
    window_started_at,
    request_count
  )
  VALUES (_user_id, now(), 1)
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN request_window.window_started_at <= now() - interval '1 hour' THEN now()
      ELSE request_window.window_started_at
    END,
    request_count = CASE
      WHEN request_window.window_started_at <= now() - interval '1 hour' THEN 1
      ELSE request_window.request_count + 1
    END
  RETURNING request_count INTO requests_in_window;

  RETURN requests_in_window <= 30;
END;
$$;

REVOKE ALL ON TABLE public.voice_product_request_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_voice_product_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voice_product_request(uuid) TO service_role;
