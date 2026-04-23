"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Prompt } from "./components/prompt";
import { Result } from "./components/result";
import { SmoothScroll } from "./components/smooth-scroll";
import { buildUnavailableResult, type DemoResult } from "./lib/demo-results";

// 3D Earth — client-only, deferred to keep TTFB clean
const HeroGlobe = dynamic(
  () => import("./components/hero-globe").then((m) => m.HeroGlobe),
  { ssr: false }
);

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; query: string; requestId: number }
  | { kind: "done"; query: string; result: DemoResult };

function composeAnchoredQuery(question: string, anchorLabel: string): string {
  const q = question.trim();
  const anchor = anchorLabel.trim();
  if (!q) return anchor;
  const lower = q.toLowerCase();
  if (lower.includes(anchor.toLowerCase())) return q;
  return `${q} near ${anchor}`;
}

function composeDeepenQuery(anchorLabel: string): string {
  return `Recent trends, comparable sites, and regulatory or press timeline around ${anchorLabel}`;
}

/**
 * Vantage — the working prototype.
 *
 * No pipeline popup: the prompt shows a quiet "Analyzing…" indicator
 * while the request is in flight, and the result fades in the moment
 * the response returns.
 */
export default function Home() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [thread, setThread] = useState<string[]>([]);
  const requestRef = useRef(0);

  const handleAsk = useCallback((query: string, force = false) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setPhase({ kind: "loading", query, requestId });

    void fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, force }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Analyze failed with ${response.status}`);
        return (await response.json()) as { result: DemoResult };
      })
      .then(({ result }) => {
        setPhase((current) => {
          if (current.kind !== "loading" || current.requestId !== requestId) return current;
          return { kind: "done", query: current.query, result };
        });
      })
      .catch((error) => {
        console.error("[page] analyze request failed", error);
        setPhase((current) => {
          if (current.kind !== "loading" || current.requestId !== requestId) return current;
          return { kind: "done", query: current.query, result: buildUnavailableResult(current.query) };
        });
      });
  }, []);

  const handleReset = useCallback(() => {
    setPhase({ kind: "idle" });
    setThread([]);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const pushToThread = useCallback((query: string) => {
    setThread((prior) => [...prior, query]);
  }, []);

  const handleFollowUp = useCallback(
    (question: string) => {
      if (phase.kind !== "done") return;
      const anchor = phase.result.anchor;
      if (!anchor) return;
      pushToThread(phase.query);
      handleAsk(composeAnchoredQuery(question, anchor.label));
    },
    [phase, pushToThread, handleAsk],
  );

  const handleDeepen = useCallback(() => {
    if (phase.kind !== "done") return;
    const anchor = phase.result.anchor;
    if (!anchor) return;
    pushToThread(phase.query);
    handleAsk(composeDeepenQuery(anchor.label));
  }, [phase, pushToThread, handleAsk]);

  const isDone = phase.kind === "done";
  const isLoading = phase.kind === "loading";

  return (
    <main className={`vantage-root${isDone ? " is-result" : ""}`}>
      <SmoothScroll />

      {!isDone && <HeroGlobe />}

      {!isDone && (
        <Prompt
          onSubmit={handleAsk}
          initialValue={isLoading ? phase.query : undefined}
          loading={isLoading}
        />
      )}

      {isDone && (
        <>
          <Prompt compact onSubmit={handleAsk} initialValue={phase.query} />
          <Result
            result={phase.result}
            onReset={handleReset}
            onForceRun={() => handleAsk(phase.query, true)}
            onFollowUp={handleFollowUp}
            onDeepen={handleDeepen}
            thread={thread}
          />
        </>
      )}
    </main>
  );
}
