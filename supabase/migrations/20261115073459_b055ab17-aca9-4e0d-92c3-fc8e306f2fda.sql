ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS heading double precision,
  ADD COLUMN IF NOT EXISTS speed_mps double precision,
  ADD COLUMN IF NOT EXISTS location_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rider_heading double precision,
  ADD COLUMN IF NOT EXISTS rider_location_at timestamptz;

CREATE OR REPLACE FUNCTION public.rider_location_ping(
  _lat double precision,
  _lng double precision,
  _heading double precision DEFAULT NULL,
  _speed double precision DEFAULT NULL,
  _recorded_at timestamptz DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r public.riders;
  at_time timestamptz;
  dt double precision;
  dist double precision;
  hdg double precision;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180
     OR (_lat = 0 AND _lng = 0) THEN
    RETURN 'invalid';
  END IF;

  SELECT * INTO r FROM public.riders WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your rider profile first'; END IF;
  IF NOT r.online THEN RETURN 'offline'; END IF;

  -- Trust the phone's timestamp only when it is close to the server clock.
  at_time := COALESCE(_recorded_at, now());
  IF at_time > now() + interval '30 seconds' OR at_time < now() - interval '2 minutes' THEN
    at_time := now();
  END IF;

  IF r.location_at IS NOT NULL THEN
    IF at_time <= r.location_at THEN RETURN 'stale'; END IF;
    dt := extract(epoch FROM (at_time - r.location_at));
    IF dt < 3 THEN RETURN 'throttled'; END IF;
    IF r.lat IS NOT NULL AND r.lng IS NOT NULL THEN
      dist := 2 * 6371000 * asin(sqrt(
        power(sin(radians(_lat - r.lat) / 2), 2) +
        cos(radians(r.lat)) * cos(radians(_lat)) * power(sin(radians(_lng - r.lng) / 2), 2)
      ));
      IF dist / dt > 45 THEN RETURN 'rejected_jump'; END IF;
    END IF;
  END IF;

  hdg := CASE WHEN _heading IS NULL OR _heading < 0 OR _heading >= 360 OR _heading <> _heading
              THEN r.heading ELSE _heading END;

  UPDATE public.riders
  SET lat = _lat, lng = _lng, heading = hdg,
      speed_mps = CASE WHEN _speed IS NULL OR _speed < 0 OR _speed > 60 THEN NULL ELSE _speed END,
      location_at = at_time
  WHERE id = auth.uid();

  UPDATE public.orders
  SET rider_lat = _lat, rider_lng = _lng, rider_heading = hdg, rider_location_at = at_time
  WHERE rider_id = auth.uid() AND status IN ('Assigned', 'In Transit', 'Out for Delivery');

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.rider_location_ping(double precision, double precision, double precision, double precision, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_location_ping(double precision, double precision, double precision, double precision, timestamptz) TO authenticated;