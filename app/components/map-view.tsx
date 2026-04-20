"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { AOI } from "../lib/demo-results";

type Props = {
  aoi: AOI;
};

/**
 * Evidence map — CartoDB positron raster tiles (light, no API key).
 * AOI polygons are rendered as:
 *   - "previous" (dashed outline, neutral fill) — the before footprint
 *   - "current"  (solid outline, accent fill)  — the after footprint
 *
 * The map re-centers whenever the AOI prop changes (new query).
 */
export function MapView({ aoi }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Initialize once
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          positron: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: "positron",
            type: "raster",
            source: "positron",
          },
        ],
      },
      center: aoi.center,
      zoom: aoi.zoom,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      // MapLibre v5 nests WebGL attrs here. preserveDrawingBuffer keeps the
      // backbuffer readable so headless screenshots capture the tiles
      // (normal users see no difference).
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    map.on("load", () => {
      drawAoi(map, aoi);
    });

    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __map?: maplibregl.Map }).__map = map;
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update when AOI changes
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
    };

    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [aoi]);

  return (
    <div
      ref={container}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 360,
        borderRadius: 18,
        overflow: "hidden",
      }}
    />
  );
}

/* ------------------------------------------------------------------
   helpers
   ------------------------------------------------------------------ */

function drawAoi(map: maplibregl.Map, aoi: AOI) {
  // Remove previous layers + source if they exist
  ["aoi-fill-current", "aoi-fill-previous", "aoi-line-current", "aoi-line-previous"].forEach(
    (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    }
  );
  if (map.getSource("aoi")) map.removeSource("aoi");

  const features = aoi.polygons.map((p) => ({
    type: "Feature" as const,
    properties: { accent: p.accent, label: p.label, date: p.date },
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
      "fill-opacity": 0.1,
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
      "fill-opacity": 0.14,
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
    },
  });
}
