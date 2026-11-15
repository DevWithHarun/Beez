import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LatLng } from "@/lib/live-tracking";
import { useSmoothMarker, type MarkerPose } from "@/lib/use-smooth-marker";
import type { LiveTrackingMapProps } from "./LiveTrackingMap";

// Free OpenStreetMap tiles (no key), darkened with a CSS filter (.track-tiles).
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const pin = (kind: "shop" | "home", label: string) =>
  L.divIcon({
    className: "",
    html: `<div class="track-pin track-pin-${kind}" aria-label="${label}">${kind === "shop" ? "🏪" : "🏠"}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

const COURIER = L.divIcon({
  className: "",
  html: `<div class="track-courier"><div class="track-courier-arrow"></div><div class="track-courier-body">🛵</div></div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

export default function LiveTrackingMapView({ shop, home, courier, route, fitKey }: LiveTrackingMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const routeGlow = useRef<L.Polyline | null>(null);
  const courierMarker = useRef<L.Marker | null>(null);
  const shopMarker = useRef<L.Marker | null>(null);
  const homeMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([shop.lat, shop.lng], 14);
    L.tileLayer(TILES, {
      maxZoom: 19,
      className: "track-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    shopMarker.current = L.marker([shop.lat, shop.lng], { icon: pin("shop", "Shop") }).addTo(m);
    homeMarker.current = L.marker([home.lat, home.lng], { icon: pin("home", "Drop-off") }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      courierMarker.current = null;
      routeLine.current = null;
      routeGlow.current = null;
    };
  }, []);

  useEffect(() => {
    shopMarker.current?.setLatLng([shop.lat, shop.lng]);
    homeMarker.current?.setLatLng([home.lat, home.lng]);
  }, [shop.lat, shop.lng, home.lat, home.lng]);

  // Road route polyline (amber with a soft glow).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const latlngs = (route ?? []).map((p) => [p.lat, p.lng] as [number, number]);
    if (latlngs.length < 2) {
      routeLine.current?.remove();
      routeGlow.current?.remove();
      routeLine.current = routeGlow.current = null;
      return;
    }
    if (!routeLine.current) {
      routeGlow.current = L.polyline(latlngs, { className: "track-route-glow", weight: 10, interactive: false }).addTo(m);
      routeLine.current = L.polyline(latlngs, { className: "track-route", weight: 4, interactive: false }).addTo(m);
    } else {
      routeGlow.current?.setLatLngs(latlngs);
      routeLine.current.setLatLngs(latlngs);
    }
  }, [route]);

  // Fit the view when the stage changes, not on every GPS packet.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts: LatLng[] = [shop, home, ...(courier ? [courier] : []), ...(route ?? [])];
    // Keep pins clear of the details sheet: below it on phones, beside it on wide screens.
    const size = m.getSize();
    const wide = size.x >= 640;
    m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), {
      paddingTopLeft: wide ? [440, 80] : [32, 80],
      paddingBottomRight: wide ? [60, 40] : [32, Math.min(380, Math.round(size.y * 0.5))],
      maxZoom: 16,
    });
  }, [fitKey, !!courier, !!route]);

  const applyPose = (pose: MarkerPose) => {
    const m = map.current;
    if (!m) return;
    if (!courierMarker.current) {
      courierMarker.current = L.marker([pose.lat, pose.lng], { icon: COURIER, zIndexOffset: 1000, keyboard: false }).addTo(m);
    } else {
      courierMarker.current.setLatLng([pose.lat, pose.lng]);
    }
    const arrow = courierMarker.current.getElement()?.querySelector<HTMLElement>(".track-courier-arrow");
    if (arrow) arrow.style.transform = `rotate(${pose.heading}deg)`;
  };

  useSmoothMarker(courier, applyPose);

  useEffect(() => {
    if (!courier && courierMarker.current) {
      courierMarker.current.remove();
      courierMarker.current = null;
    }
  }, [courier]);

  return <div ref={el} className="track-map" role="application" aria-label="Live delivery map" />;
}
