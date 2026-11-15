import { useEffect, useRef } from "react";
import { easeInOutCubic, lerp, lerpHeading } from "@/lib/live-tracking";

export type MarkerPose = { lat: number; lng: number; heading: number };

/**
 * Glides a marker toward each new GPS packet at 60fps with a cubic ease and
 * shortest-arc rotation. `apply` is called every frame (outside React state)
 * so the map marker moves without re-rendering the page.
 */
export function useSmoothMarker(
  target: MarkerPose | null,
  apply: (pose: MarkerPose) => void,
  durationMs = 3_800,
) {
  const current = useRef<MarkerPose | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!target) return;
    const from = current.current;
    if (!from) {
      current.current = target;
      applyRef.current(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = easeInOutCubic((now - start) / durationMs);
      const pose = {
        lat: lerp(from.lat, target.lat, t),
        lng: lerp(from.lng, target.lng, t),
        heading: lerpHeading(from.heading, target.heading, t),
      };
      current.current = pose;
      applyRef.current(pose);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.lat, target?.lng, target?.heading, durationMs]);
}
