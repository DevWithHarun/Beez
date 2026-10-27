import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { DbOrder } from '@/lib/live-orders';

const MOMBASA: [number, number] = [-4.0435, 39.6682];

function pin(emoji: string, bg: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:16px">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
const PICKUP = pin('🏪', '#ff8a1f');
const DROP = pin('🏠', '#2f8cff');
const RIDER = pin('🛵', '#ffc61a');

export default function LiveMap({ orders, tall = false }: { orders: DbOrder[]; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: MOMBASA, zoom: 12, zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const o of orders) {
      L.marker([o.pickup_lat, o.pickup_lng], { icon: PICKUP })
        .bindTooltip(`${o.merchant_name} · ${o.pickup_area}`)
        .addTo(layers);
      L.marker([o.drop_lat, o.drop_lng], { icon: DROP })
        .bindTooltip(`${o.customer_area} · ${o.id}`)
        .addTo(layers);
      points.push([o.pickup_lat, o.pickup_lng], [o.drop_lat, o.drop_lng]);
      if (o.rider_lat != null && o.rider_lng != null) {
        L.marker([o.rider_lat, o.rider_lng], { icon: RIDER, zIndexOffset: 500 })
          .bindTooltip(`Rider · ${o.id} · ${o.status}`)
          .addTo(layers);
        points.push([o.rider_lat, o.rider_lng]);
        L.polyline(
          [
            [o.pickup_lat, o.pickup_lng],
            [o.rider_lat, o.rider_lng],
            [o.drop_lat, o.drop_lng],
          ],
          { color: '#ffc61a', weight: 3, dashArray: '6 8', opacity: 0.9 },
        ).addTo(layers);
      }
    }
    if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.15));
  }, [orders]);

  return <div ref={ref} className="market-map live" style={{ height: tall ? 440 : 300, width: '100%' }} />;
}
