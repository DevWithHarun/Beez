import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveHeading, shouldSendPing, type Fix } from "@/lib/live-tracking";

export type PingState =
  | { kind: "off" }
  | { kind: "starting" }
  | { kind: "sending"; lastSentAt: number | null }
  | { kind: "blocked" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

/**
 * While the rider is online, watches the phone's GPS and sends a location at
 * most every 4 seconds. Impossible jumps are dropped here and again on the
 * server. During an active delivery the screen is kept awake where supported.
 */
export function useCourierLocationPing(online: boolean, activeDelivery: boolean) {
  const [state, setState] = useState<PingState>({ kind: "off" });
  const lastSent = useRef<Fix | null>(null);
  const lastHeading = useRef<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!online) {
      setState({ kind: "off" });
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ kind: "unsupported" });
      return;
    }
    setState({ kind: "starting" });
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const fix: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: pos.timestamp || Date.now() };
        if (inFlight.current || !shouldSendPing(lastSent.current, fix)) return;
        const heading = resolveHeading(pos.coords.heading, lastSent.current, fix) ?? lastHeading.current;
        inFlight.current = true;
        try {
          const args: {
            _lat: number;
            _lng: number;
            _recorded_at: string;
            _heading?: number;
            _speed?: number;
          } = { _lat: fix.lat, _lng: fix.lng, _recorded_at: new Date(fix.at).toISOString() };
          if (heading != null) args._heading = heading;
          if (pos.coords.speed != null) args._speed = pos.coords.speed;
          const { data, error } = await supabase.rpc("rider_location_ping", args);
          if (error) throw error;
          if (data === "ok" || data === "throttled" || data === "stale") {
            if (data === "ok") {
              lastSent.current = fix;
              lastHeading.current = heading;
            }
            setState({ kind: "sending", lastSentAt: lastSent.current?.at ?? null });
          } else if (data === "rejected_jump") {
            // Keep waiting for a believable fix; the server kept the last good one.
          }
        } catch (err) {
          console.error("Location update failed", err);
          setState({ kind: "error", message: "Location not sent — check your data connection." });
        } finally {
          inFlight.current = false;
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ kind: "blocked" });
        else setState({ kind: "error", message: "Waiting for a GPS signal…" });
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [online]);

  // Keep the screen on during a delivery so the browser doesn't pause GPS.
  useEffect(() => {
    if (!online || !activeDelivery) return;
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock!.request("screen").then(
        (l) => (cancelled ? void l.release() : (lock = l)),
        () => undefined,
      );
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [online, activeDelivery]);

  return state;
}
