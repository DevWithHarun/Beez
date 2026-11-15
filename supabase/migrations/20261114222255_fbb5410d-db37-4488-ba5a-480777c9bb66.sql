CREATE TABLE public.guest_session_windows (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.guest_session_windows TO service_role;
ALTER TABLE public.guest_session_windows ENABLE ROW LEVEL SECURITY;

-- True when this connection may start another guest checkout (12 per hour).
CREATE OR REPLACE FUNCTION public.consume_guest_session(_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  allowed boolean;
BEGIN
  INSERT INTO public.guest_session_windows AS w (ip_hash, window_started_at, request_count)
  VALUES (_ip_hash, now(), 1)
  ON CONFLICT (ip_hash) DO UPDATE SET
    window_started_at = CASE WHEN w.window_started_at < now() - interval '1 hour' THEN now() ELSE w.window_started_at END,
    request_count = CASE WHEN w.window_started_at < now() - interval '1 hour' THEN 1 ELSE w.request_count + 1 END
  RETURNING request_count <= 12 INTO allowed;
  DELETE FROM public.guest_session_windows WHERE window_started_at < now() - interval '1 day';
  RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.consume_guest_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_session(text) TO service_role;