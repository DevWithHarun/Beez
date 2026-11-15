import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { LatLng } from "@/lib/live-tracking";
import type { MarkerPose } from "@/lib/use-smooth-marker";

export type LiveTrackingMapProps = {
  shop: LatLng;
  home: LatLng;
  courier: MarkerPose | null;
  route: LatLng[] | null;
  /** Changing this re-fits the map (e.g. when the delivery stage changes). */
  fitKey: string;
};

// Leaflet is browser-only: the CSS and map module load lazily after hydration.
const MapView = lazy(async () => {
  await import("@/leaflet-css");
  return import("./live-tracking-map-view");
});

export function LiveTrackingMap(props: LiveTrackingMapProps) {
  const fallback = <div className="track-map" aria-hidden />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <MapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}
