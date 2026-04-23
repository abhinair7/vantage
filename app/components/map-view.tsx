"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import maplibregl from "maplibre-gl";
import type { AOI, Marker as VxMarker } from "../lib/demo-results";

export type BasemapKey = "satellite" | "light" | "terrain";

/** Imperative handle callers use to drive the map from outside. */
export type MapHandle = {
  flyToEvidence: (evidenceId: string) => void;
  fitToAoi: () => void;
  setBasemap: (b: BasemapKey) => void;
};

type Props = {
  aoi: AOI;
  /** Called when the user clicks a polygon/marker tied to an evidence id. */
  onFeatureClick?: (evidenceId: string) => void;
  /** Show the before/after crossfade slider when there are two polygons. */
  enableCompare?: boolean;
};

// Tile sources — all free, no API key required.
const BASEMAPS: Record<
  BasemapKey,
  { tiles: string[]; attribution: string; maxzoom: number }
> = {
  light: {
    tiles: [
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
    ],
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    maxzoom: 19,
  },
  satellite: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution:
      "Tiles © <a href=\"https://www.esri.com\">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxzoom: 19,
  },
  terrain: {
    tiles: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    attribution:
      'Map data: © <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors, SRTM | Tiles © <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxzoom: 17,
  },
};

/**
 * Evidence map with full interactivity:
 *   - basemap toggle  (light positron  / ESRI satellite / OpenTopoMap)
 *   - before/after crossfade slider when two polygons are present
 *   - domain markers  (vessels, tanks, beacons) rendered as pinned HTML
 *   - click a polygon or marker → emits evidenceRef to parent
 *   - imperative handle so the parent can flyToEvidence(id) from anywhere
 */
export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { aoi, onFeatureClick, enableCompare = true },
  ref
) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<Map<string, maplibregl.Marker>>(new Map());
  const onFeatureClickRef = useRef(onFeatureClick);
  onFeatureClickRef.current = onFeatureClick;

  const [basemap, setBasemapState] = useState<BasemapKey>("satellite");
  // Crossfade position 0..1. 0 = before only, 1 = after only.
  const [compare, setCompare] = useState(0.5);

  const hasBoth = useMemo(
    () =>
      aoi.polygons.some((p) => p.accent === "previous") &&
      aoi.polygons.some((p) => p.accent === "current"),
    [aoi]
  );

  /* ---------------- Initialize once ---------------- */
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const base = BASEMAPS.satellite;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: base.tiles,
            tileSize: 256,
            attribution: base.attribution,
            maxzoom: base.maxzoom,
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: aoi.center,
      zoom: aoi.zoom,
      attributionControl: false,
      cooperativeGestures: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    map.on("load", () => {
      drawAoi(map, aoi);
      wireClicks(map, onFeatureClickRef);
    });

    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __map?: maplibregl.Map }).__map = map;
    }

    return () => {
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- React to basemap change ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("basemap") as maplibregl.RasterTileSource | undefined;
    if (!src) return;
    const cfg = BASEMAPS[basemap];
    src.setTiles(cfg.tiles);
  }, [basemap]);

  /* ---------------- React to AOI changes ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      map.flyTo({
        center: aoi.center,
        zoom: aoi.zoom,
        speed: 0.9,
        curve: 1.4,
      });
      drawAoi(map, aoi);
      drawMarkers(map, aoi, markerRefs.current, onFeatureClickRef);
    };

    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [aoi]);

  /* ---------------- Compare slider — live crossfade ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasBoth) return;

    const before = 1 - compare; // 1 at far-left, 0 at far-right
    const after = compare;

    const setIf = (id: string, prop: string, value: number) => {
      if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
    };

    setIf("aoi-fill-previous", "fill-opacity", 0.25 * before);
    setIf("aoi-line-previous", "line-opacity", 0.35 + 0.65 * before);
    setIf("aoi-fill-current", "fill-opacity", 0.3 * after);
    setIf("aoi-line-current", "line-opacity", 0.35 + 0.65 * after);
  }, [compare, hasBoth, aoi]);

  /* ---------------- Imperative handle ---------------- */
  const setBasemap = useCallback((b: BasemapKey) => setBasemapState(b), []);

  useImperativeHandle(
    ref,
    () => ({
      setBasemap,
      fitToAoi: () => {
        const map = mapRef.current;
        if (!map) return;
        const b = aoiBounds(aoi);
        if (b) map.fitBounds(b, { padding: 80, duration: 700, maxZoom: 17 });
        else map.flyTo({ center: aoi.center, zoom: aoi.zoom });
      },
      flyToEvidence: (evidenceId: string) => {
        const map = mapRef.current;
        if (!map) return;

        const focus = aoi.evidenceFocus?.[evidenceId];
        if (focus) {
          map.flyTo({
            center: focus.center,
            zoom: focus.zoom ?? aoi.zoom + 1,
            speed: 1.1,
            curve: 1.5,
          });
        }

        // Pulse all polygons + markers that back this evidence id
        pulsePolygon(map, evidenceId);
        markerRefs.current.forEach((m, key) => {
          const el = m.getElement();
          if (el.dataset.evidenceRef === evidenceId) {
            el.classList.remove("is-focused");
            // Force reflow so the animation re-plays
            void el.offsetWidth;
            el.classList.add("is-focused");
          } else {
            el.classList.remove("is-focused");
          }
          void key;
        });
      },
    }),
    [aoi, setBasemap]
  );

  /* ---------------- Render ---------------- */
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={container}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 460,
          borderRadius: 18,
          overflow: "hidden",
        }}
      />

      <div className="map-edge-fade" aria-hidden />

      {/* Top-right: basemap segmented control + zoom + fit */}
      <div
        className="map-chrome"
        style={{ top: "0.8rem", right: "0.8rem" }}
      >
        <button
          type="button"
          className={`seg ${basemap === "satellite" ? "is-active" : ""}`}
          onClick={() => setBasemapState("satellite")}
          title="Satellite imagery (Esri World Imagery)"
        >
          Satellite
        </button>
        <button
          type="button"
          className={`seg ${basemap === "light" ? "is-active" : ""}`}
          onClick={() => setBasemapState("light")}
          title="Light basemap (CartoDB Positron)"
        >
          Context
        </button>
        <button
          type="button"
          className={`seg ${basemap === "terrain" ? "is-active" : ""}`}
          onClick={() => setBasemapState("terrain")}
          title="Topographic (OpenTopoMap)"
        >
          Terrain
        </button>
        <span className="divider" aria-hidden />
        <button
          type="button"
          className="seg"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          title="Zoom in"
          style={{ minWidth: 28 }}
        >
          +
        </button>
        <button
          type="button"
          className="seg"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          title="Zoom out"
          style={{ minWidth: 28 }}
        >
          −
        </button>
        <button
          type="button"
          className="seg"
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            const b = aoiBounds(aoi);
            if (b) map.fitBounds(b, { padding: 80, duration: 700, maxZoom: 17 });
            else map.flyTo({ center: aoi.center, zoom: aoi.zoom });
          }}
          title="Fit to area of interest"
        >
          Fit
        </button>
      </div>

      {/* Bottom-left: corner badges (label + date per polygon) */}
      <div
        style={{
          position: "absolute",
          top: "0.8rem",
          left: "0.8rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <div className="map-scene-pill">
          <span className="mono">SATELLITE DEFAULT</span>
        </div>
        {aoi.polygons.map((p) => (
          <div
            key={p.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.3rem 0.6rem",
              background: "rgba(6, 10, 22, 0.78)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              fontSize: 11.5,
              color: "rgba(255,255,255,0.82)",
              backdropFilter: "saturate(160%) blur(8px)",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background:
                  p.accent === "current"
                    ? "rgba(125, 249, 255, 0.28)"
                    : "rgba(253, 224, 71, 0.18)",
                border:
                  p.accent === "current"
                    ? "1.5px solid #7DF9FF"
                    : "1.5px dashed #FDE047",
              }}
            />
            <span
              className="mono"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.72)" }}
            >
              {p.date}
            </span>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>· {p.label}</span>
          </div>
        ))}
      </div>

      <div
        className="map-attribution"
        dangerouslySetInnerHTML={{ __html: BASEMAPS[basemap].attribution }}
      />

      {/* Compare slider — only when both before and after polygons exist */}
      {enableCompare && hasBoth && (
        <div
          className="compare-slider"
          style={{
            ["--pos" as string]: `${Math.round(compare * 100)}%`,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: "rgba(255,255,255,0.7)",
              whiteSpace: "nowrap",
            }}
          >
            BEFORE
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(compare * 100)}
            onChange={(e) => setCompare(Number(e.target.value) / 100)}
            aria-label="Before / after reveal"
          />
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: "#8cc8ff",
              whiteSpace: "nowrap",
            }}
          >
            AFTER
          </span>
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------
   helpers
   ------------------------------------------------------------------ */

function drawAoi(map: maplibregl.Map, aoi: AOI) {
  [
    "aoi-fill-current",
    "aoi-fill-previous",
    "aoi-line-current",
    "aoi-line-previous",
  ].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource("aoi")) map.removeSource("aoi");

  const features = aoi.polygons.map((p, i) => ({
    type: "Feature" as const,
    id: i,
    properties: {
      accent: p.accent,
      label: p.label,
      date: p.date,
      evidenceRef: p.evidenceRef ?? "",
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [p.coords],
    },
  }));

  map.addSource("aoi", {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });

  // previous (before)
  map.addLayer({
    id: "aoi-fill-previous",
    type: "fill",
    source: "aoi",
    filter: ["==", ["get", "accent"], "previous"],
    paint: {
      "fill-color": "#6E6E73",
      "fill-opacity": 0.12,
      "fill-opacity-transition": { duration: 220 },
    },
  });
  map.addLayer({
    id: "aoi-line-previous",
    type: "line",
    source: "aoi",
    filter: ["==", ["get", "accent"], "previous"],
    paint: {
      "line-color": "#6E6E73",
      "line-width": 1.6,
      "line-dasharray": [2, 2],
      "line-opacity": 1,
      "line-opacity-transition": { duration: 220 },
    },
  });

  // current (after)
  map.addLayer({
    id: "aoi-fill-current",
    type: "fill",
    source: "aoi",
    filter: ["==", ["get", "accent"], "current"],
    paint: {
      "fill-color": "#0071E3",
      "fill-opacity": 0.16,
      "fill-opacity-transition": { duration: 220 },
    },
  });
  map.addLayer({
    id: "aoi-line-current",
    type: "line",
    source: "aoi",
    filter: ["==", ["get", "accent"], "current"],
    paint: {
      "line-color": "#0071E3",
      "line-width": 2.2,
      "line-opacity": 1,
      "line-opacity-transition": { duration: 220 },
    },
  });
}

function drawMarkers(
  map: maplibregl.Map,
  aoi: AOI,
  bucket: Map<string, maplibregl.Marker>,
  onClickRef: MutableRefObject<((id: string) => void) | undefined>
) {
  // Clear previous
  bucket.forEach((m) => m.remove());
  bucket.clear();

  (aoi.markers ?? []).forEach((m) => {
    const el = buildMarkerElement(m);
    el.dataset.evidenceRef = m.evidenceRef ?? "";
    if (m.evidenceRef && onClickRef.current) {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onClickRef.current?.(m.evidenceRef!);
      });
    }
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat(m.coord)
      .addTo(map);

    if (m.label) {
      marker.setPopup(
        new maplibregl.Popup({ offset: 14, closeButton: false, className: "vx-popup" })
          .setHTML(
            `<div style="font-family:var(--font-body);font-size:12px;color:#1D1D1F;letter-spacing:-0.01em;">${escapeHtml(
              m.label
            )}</div>`
          )
      );
      el.addEventListener("mouseenter", () => marker.togglePopup());
      el.addEventListener("mouseleave", () => marker.togglePopup());
    }

    bucket.set(m.id, marker);
  });
}

function buildMarkerElement(m: VxMarker): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vx-marker";
  if (m.kind === "vessel") {
    el.classList.add("vx-vessel");
  } else if (m.kind === "tank") {
    el.classList.add("vx-tank");
    el.style.setProperty("--fill", String(m.fill ?? 0.5));
  } else if (m.kind === "beacon") {
    el.classList.add("vx-beacon");
  }
  return el;
}

function wireClicks(
  map: maplibregl.Map,
  onClickRef: MutableRefObject<((id: string) => void) | undefined>
) {
  const layers = ["aoi-fill-previous", "aoi-fill-current"];
  layers.forEach((layer) => {
    map.on("click", layer, (e) => {
      const f = e.features?.[0];
      const ref = f?.properties?.evidenceRef as string | undefined;
      if (ref) onClickRef.current?.(ref);
    });
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function pulsePolygon(map: maplibregl.Map, evidenceId: string) {
  const lineIds = ["aoi-line-previous", "aoi-line-current"];
  lineIds.forEach((id) => {
    if (!map.getLayer(id)) return;
    const src = map.getSource("aoi") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    // Temporarily thicken the matching polygon's outline
    const expr = [
      "case",
      ["==", ["get", "evidenceRef"], evidenceId],
      id.endsWith("current") ? 4.5 : 3.5,
      id.endsWith("current") ? 2.2 : 1.6,
    ];
    map.setPaintProperty(id, "line-width", expr as unknown as number);
  });
  window.setTimeout(() => {
    if (map.getLayer("aoi-line-current"))
      map.setPaintProperty("aoi-line-current", "line-width", 2.2);
    if (map.getLayer("aoi-line-previous"))
      map.setPaintProperty("aoi-line-previous", "line-width", 1.6);
  }, 1400);
}

function aoiBounds(aoi: AOI): maplibregl.LngLatBoundsLike | null {
  const pts: [number, number][] = [];
  aoi.polygons.forEach((p) => pts.push(...p.coords));
  (aoi.markers ?? []).forEach((m) => pts.push(m.coord));
  if (pts.length === 0) return null;
  let minX = pts[0][0],
    minY = pts[0][1],
    maxX = pts[0][0],
    maxY = pts[0][1];
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
      ? "&lt;"
      : c === ">"
      ? "&gt;"
      : c === '"'
      ? "&quot;"
      : "&#39;"
  );
}
