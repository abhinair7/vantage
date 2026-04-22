"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { Prompt } from "./components/prompt";
import { Result } from "./components/result";
import { LoadingOverlay } from "./components/loading-overlay";
import { SmoothScroll } from "./components/smooth-scroll";
import { TelescopeReticle } from "./components/telescope-reticle";
import { matchQuery, type DemoResult } from "./lib/demo-results";

// 3D Earth — client-only, deferred to keep TTFB clean
const HeroGlobe = dynamic(
  () => import("./components/hero-globe").then((m) => m.HeroGlobe),
  { ssr: false }
);

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; query: string; pending: DemoResult }
  | { kind: "done"; query: string; result: DemoResult };

/**
 * Vantage — the working prototype.
 *
 * New flow (no dedicated "running" page):
 *   idle     → user asks → loading overlay appears over the hero
 *   loading  → pipeline animates → overlay dismisses
 *   done     → result page fades in
 *
 * The 3D globe lives in a fixed layer behind the content and is only
 * rendered while we're on the idle screen — once there's an answer, the
 * viewport belongs to the map and we don't want two GPU surfaces fighting.
 */
export default function Home() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const handleAsk = useCallback((query: string) => {
    const pending = matchQuery(query);
    setPhase({ kind: "loading", query, pending });
  }, []);

  const handleLoadingDone = useCallback(() => {
    setPhase((p) =>
      p.kind === "loading"
        ? { kind: "done", query: p.query, result: p.pending }
        : p
    );
  }, []);

  const handleReset = useCallback(() => {
    setPhase({ kind: "idle" });
    // Return to the top so the hero scroll animation replays naturally
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const isDone = phase.kind === "done";

  return (
    <main className={`vantage-root${isDone ? " is-result" : ""}`}>
      <SmoothScroll />

      {/* Earth renders for idle AND loading, so the overlay popup floats
          over a live 3D background — not a blank white page. It only
          unmounts once we transition to the answer (done). */}
      {phase.kind !== "done" && <HeroGlobe />}

      {/* Telescope HUD — aperture, reticle, corner brackets, live
          instrument readouts. Rides on top of the globe but below any
          foreground UI. Only shown while the hero is in view. */}
      {phase.kind !== "done" && <TelescopeReticle />}

      {/* Landing hero stays underneath during loading too */}
      {phase.kind !== "done" && <Prompt onSubmit={handleAsk} />}

      {/* Answer screen */}
      {phase.kind === "done" && (
        <>
          <Prompt compact onSubmit={handleAsk} initialValue={phase.query} />
          <Result result={phase.result} onReset={handleReset} />
        </>
      )}

      {/* Pipeline overlay — shown on top of everything while loading */}
      <AnimatePresence>
        {phase.kind === "loading" && (
          <LoadingOverlay
            key="loading-overlay"
            query={phase.query}
            result={phase.pending}
            onDone={handleLoadingDone}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
