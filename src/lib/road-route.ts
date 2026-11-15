import { parseOsrmRoute, type LatLng } from "@/lib/live-tracking";

// Free public OSRM road routing (no key). Browser-only; failures fall back to straight lines.
export async function fetchRoadRoute(points: LatLng[], signal?: AbortSignal) {
  const path = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Road route unavailable (${res.status})`);
  return parseOsrmRoute(await res.json());
}
