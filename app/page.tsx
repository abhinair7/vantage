"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { Prompt } from "./components/prompt";
import { Result } from "./components/result";
import { LoadingOverlay } from "./components/loading-overlay";
import { SmoothScroll } from "./components/smooth-scroll";
import { TelescopeReticle } from "./components/telescope-reticle";
import {
  buildUnavailableResult,
  estimateRunProfile,
  type AnalysisRunProfile,
  type DemoResult,
} from "./lib/demo-results";

// 3D Earth — client-only, deferred to keep TTFB clean
const HeroGlobe = dynamic(
  () => import("./components/hero-globe").then((m) => m.HeroGlobe),
  { ssr: false }
);

type Phase =
  | { kind: "idle" }
  | {
      kind: "loading";
      query: string;
      pending: AnalysisRunProfile;
      resolved?: DemoResult;
      requestId: number;
      ready: boolean;
      overlayDone: boolean;
    }
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
  const requestRef = useRef(0);

  const handleAsk = useCallback((query: string) => {
    const pending = estimateRunProfile(query);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setPhase({
      kind: "loading",
      query,
      pending,
      resolved: undefined,
      requestId,
      ready: false,
      overlayDone: false,
    });

    void fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Analyze failed with ${response.status}`);
        return (await response.json()) as { result: DemoResult };
      })
      .then(({ result }) => {
        setPhase((current) => {
          if (current.kind !== "loading" || current.requestId !== requestId) {
            return current;
          }

          if (current.overlayDone) {
            return { kind: "done", query: current.query, result };
          }

          return {
            ...current,
            resolved: result,
            ready: true,
          };
        });
      })
      .catch((error) => {
        console.error("[page] analyze request failed", error);
        setPhase((current) => {
          if (current.kind !== "loading" || current.requestId !== requestId) {
            return current;
          }
          const fallback = buildUnavailableResult(current.query);
          if (current.overlayDone) {
            return { kind: "done", query: current.query, result: fallback };
          }
          return {
            ...current,
            resolved: fallback,
            ready: true,
          };
        });
      });
  }, []);

  const handleLoadingDone = useCallback(() => {
    setPhase((p) =>
      p.kind === "loading"
        ? p.ready
          ? {
              kind: "done",
              query: p.query,
              result: p.resolved ?? buildUnavailableResult(p.query),
            }
          : { ...p, overlayDone: true }
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

      {/* Orbital foreground layer — vignette, glints, and near-camera
          debris hints. Rides on top of the globe but below any
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
            profile={phase.pending}
            onDone={handleLoadingDone}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
