"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The telescope HUD. Sits on top of the 3D globe as a fixed overlay and
 * turns the hero from "a 3D planet" into "looking THROUGH something AT
 * a planet." Every number updates with the same scroll progress that
 * drives the camera dolly on the Earth itself, so the instrument reads
 * feel connected to what you see.
 *
 * No entrance animations — the user asked for a sleek landing, no
 * staggers. The reticle is simply present.
 */
export function TelescopeReticle() {
  const [progress, setProgress] = useState(0);
  const [utc, setUtc] = useState("");
  const tickRef = useRef<number>(0);

  // Scroll → instrument readings
  useEffect(() => {
    const onScroll = () => {
      const max = window.innerHeight * 0.9;
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Once-per-second UTC tick for the readout
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      setUtc(
        d.toISOString().replace("T", " ").replace(/\..*/, "") + "Z"
      );
    };
    fmt();
    tickRef.current = window.setInterval(fmt, 1000);
    return () => window.clearInterval(tickRef.current);
  }, []);

  // Derived instrument values
  const magnification = Math.round(48 + progress * 120); // ×48 → ×168
  const fov = (0.38 - progress * 0.24).toFixed(2); // 0.38° → 0.14°
  // Fictional AOI centroid that drifts very slightly with scroll so it feels live
  const lat = (22.7345 + Math.sin(progress * 4.1) * 0.0021).toFixed(4);
  const lon = (69.7071 + Math.cos(progress * 3.4) * 0.0026).toFixed(4);

  return (
    <div className="telescope" aria-hidden>
      {/* Circular aperture — dark outside the lens */}
      <div className="telescope-vignette" />

      {/* SVG reticle: ring, ticks, crosshair */}
      <svg
        className="telescope-reticle"
        viewBox="-500 -500 1000 1000"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Primary ring */}
        <circle cx="0" cy="0" r="340" className="reticle-ring" />

        {/* Inner hairline ring */}
        <circle cx="0" cy="0" r="330" className="reticle-ring-thin" />

        {/* Ticks around the ring — every 6° */}
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i * 360) / 60;
          const major = i % 5 === 0;
          const len = major ? 14 : 6;
          const r1 = 340;
          const r2 = 340 + len;
          const rad = (angle * Math.PI) / 180;
          const x1 = Math.cos(rad) * r1;
          const y1 = Math.sin(rad) * r1;
          const x2 = Math.cos(rad) * r2;
          const y2 = Math.sin(rad) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={major ? "reticle-tick-major" : "reticle-tick-minor"}
            />
          );
        })}

        {/* Cardinal labels */}
        {["N", "E", "S", "W"].map((label, i) => {
          const angle = i * 90 - 90; // N at top
          const rad = (angle * Math.PI) / 180;
          const r = 372;
          const x = Math.cos(rad) * r;
          const y = Math.sin(rad) * r;
          return (
            <text
              key={label}
              x={x}
              y={y}
              className="reticle-cardinal"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          );
        })}

        {/* Center crosshair — short segments with a gap */}
        <line x1="-30" y1="0" x2="-6" y2="0" className="reticle-cross" />
        <line x1="6" y1="0" x2="30" y2="0" className="reticle-cross" />
        <line x1="0" y1="-30" x2="0" y2="-6" className="reticle-cross" />
        <line x1="0" y1="6" x2="0" y2="30" className="reticle-cross" />
        {/* Tiny center dot */}
        <circle cx="0" cy="0" r="1" className="reticle-center" />

        {/* Subtle mil-dot stadia */}
        {[-80, -40, 40, 80].map((x) => (
          <circle key={`h${x}`} cx={x} cy="0" r="1.2" className="reticle-dot" />
        ))}
        {[-80, -40, 40, 80].map((y) => (
          <circle key={`v${y}`} cx="0" cy={y} r="1.2" className="reticle-dot" />
        ))}
      </svg>

      {/* Corner brackets */}
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />

      {/* Top-left status */}
      <div className="telescope-readout telescope-readout-tl">
        <span className="readout-dot" />
        <span>LIVE · VANTAGE EYEPIECE</span>
      </div>

      {/* Top-right readout */}
      <div className="telescope-readout telescope-readout-tr">
        <div>
          <span className="readout-key">UTC</span>
          <span className="readout-val">{utc || "—"}</span>
        </div>
      </div>

      {/* Bottom-left readout */}
      <div className="telescope-readout telescope-readout-bl">
        <div>
          <span className="readout-key">LAT</span>
          <span className="readout-val">{lat}°N</span>
        </div>
        <div>
          <span className="readout-key">LON</span>
          <span className="readout-val">{lon}°E</span>
        </div>
      </div>

      {/* Bottom-right readout */}
      <div className="telescope-readout telescope-readout-br">
        <div>
          <span className="readout-key">MAG</span>
          <span className="readout-val">×{magnification}</span>
        </div>
        <div>
          <span className="readout-key">FOV</span>
          <span className="readout-val">{fov}°</span>
        </div>
      </div>

      {/* Scanlines, barely-there */}
      <div className="telescope-scan" />
    </div>
  );
}
