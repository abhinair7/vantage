"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Drop-in smooth-scroll. Lenis inertia-scrolls the document; the native
 * scroll event still fires so scroll-linked animations (HeroGlobe's
 * camera dolly) keep working. We disable on reduced-motion so the system
 * preference wins.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
