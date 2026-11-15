import { useEffect, useRef, useState } from "react";
import {
  fallbackEtaMinutes,
  routeWaypoints,
  shouldRefetchRoute,
  type LatLng,
} from "@/lib/live-tracking";
import { fetchRoadRoute } from "@/lib/road-route";

type RouteOrder = Parameters<typeof routeWaypoints>[0];
export type RoadRoute = { points: LatLng[]; arrivalAt: number; road: boolean };

/** Road route + arrival time for the stops still ahead, refetched only after real movement. */
export function useRoadRoute(order: RouteOrder | null) {
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const last = useRef<{ from: LatLng; at: number; key: string } | null>(null);
  const waypoints = order ? routeWaypoints(order) : null;
  const sig = waypoints ? waypoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|") : "";
  const key = order ? `${order.status}:${waypoints?.length ?? 0}` : "";

  useEffect(() => {
    if (!waypoints || !waypoints[0]) {
      setRoute(null);
      last.current = null;
      return;
    }
    const next = { from: waypoints[0], at: Date.now(), key };
    if (!shouldRefetchRoute(last.current, next)) return;
    last.current = next;
    const controller = new AbortController();
    fetchRoadRoute(waypoints, controller.signal)
      .then((r) => {
        if (!r) throw new Error("No road route");
        setRoute({ points: r.points, arrivalAt: Date.now() + r.minutes * 60_000, road: true });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn("Road route unavailable, using straight lines", err);
        setRoute({
          points: waypoints,
          arrivalAt: Date.now() + fallbackEtaMinutes(waypoints) * 60_000,
          road: false,
        });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, key]);

  return route;
}
