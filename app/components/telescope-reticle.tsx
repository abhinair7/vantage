"use client";

import { useEffect, useState } from "react";

/**
 * Telescope cinematic intro.
 *
 * The concept: you're looking through an eyepiece. The screen starts nearly
 * black with a tiny circular aperture showing the globe. Over ~3s the viewer
 * "leans in" — the aperture expands and the darkness recedes until the full
 * globe is revealed in all its IMAX glory. Then the overlay fades to nothing.
 *
 * No HUD readouts, no corner brackets, no scanlines. Just the aperture.
 */
export function TelescopeReticle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="telescope" aria-hidden>
        <div className="telescope-vignette" />
      </div>
    );
  }

  return (
    <div className="telescope" aria-hidden>
      {/* The aperture — starts tight (small hole of light), expands,
          then the entire overlay fades out to reveal the full globe. */}
      <div className="telescope-vignette" />

      {/* Thin reticle cross — appears briefly during the aperture phase,
          then fades with the vignette. Just two hairlines, nothing else. */}
      <div className="telescope-crosshair">
        <div className="crosshair-h" />
        <div className="crosshair-v" />
      </div>
    </div>
  );
}
