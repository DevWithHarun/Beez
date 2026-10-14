import { useState, type KeyboardEvent } from "react";

type MapLocation = {
  id: string;
  name: string;
  detail: string;
  x: number;
  y: number;
  kind: "pilot" | "target";
};

const locations: MapLocation[] = [
  {
    id: "kenya",
    name: "Mombasa, Kenya",
    detail: "Kenya pilot market — active now.",
    x: 360,
    y: 168,
    kind: "pilot",
  },
  {
    id: "africa",
    name: "Africa",
    detail: "Illustrative expansion target — not an active location.",
    x: 302,
    y: 151,
    kind: "target",
  },
  {
    id: "india",
    name: "India",
    detail: "Illustrative expansion target — not an active location.",
    x: 418,
    y: 128,
    kind: "target",
  },
  {
    id: "latin-america",
    name: "Latin America",
    detail: "Illustrative expansion target — not an active location.",
    x: 217,
    y: 199,
    kind: "target",
  },
  {
    id: "southeast-asia",
    name: "Southeast Asia",
    detail: "Illustrative expansion target — not an active location.",
    x: 474,
    y: 170,
    kind: "target",
  },
];

const routes = [
  "M360 168 Q330 142 302 151",
  "M360 168 Q386 140 418 128",
  "M360 168 Q278 159 217 199",
  "M360 168 Q420 157 474 170",
];

function activateOnKeyboard(event: KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

export default function PilotMapSection() {
  const [selected, setSelected] = useState(locations[0]);

  return (
    <section className="mission-map">
      <h3>Global Expansion Map &amp; Mission</h3>
      <div className="map">
        <div className="world-map-canvas">
          <img
            className="world-map-image"
            src="/global-map.png"
            alt=""
            aria-hidden="true"
            width={611}
            height={277}
          />
          <svg
            className="world-map-markers"
            viewBox="0 0 611 277"
            role="group"
            aria-label="Beez pilot and illustrative expansion targets"
          >
            <title>Beez global expansion locations</title>
            <g className="map-routes" aria-hidden="true">
              {routes.map((route) => (
                <path key={route} d={route} />
              ))}
            </g>
            {locations.map((location) => {
              const isSelected = selected.id === location.id;
              return (
                <g
                  key={location.id}
                  className={`map-marker ${location.kind}${isSelected ? " selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${location.name}. ${location.detail}`}
                  aria-pressed={isSelected}
                  transform={`translate(${location.x} ${location.y})`}
                  onClick={() => setSelected(location)}
                  onKeyDown={(event) => activateOnKeyboard(event, () => setSelected(location))}
                >
                  <circle className="marker-focus" r="16" />
                  <circle className="marker-halo" r={location.kind === "pilot" ? 12 : 9} />
                  <circle className="marker-core" r={location.kind === "pilot" ? 5 : 4} />
                  <title>{location.name}</title>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="map-detail" role="status" aria-live="polite">
          <strong>{selected.name}</strong>
          <span>{selected.detail}</span>
        </div>
        <div className="legend" aria-label="Map legend">
          <span>
            <i className="k now" aria-hidden="true" />
            Kenya pilot, now
          </span>
          <span>
            <i className="k" aria-hidden="true" />
            Illustrative expansion targets
          </span>
        </div>
      </div>
      <p className="goal">
        The target: <b>every informal merchant, counted.</b>
      </p>
    </section>
  );
}
