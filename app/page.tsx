"use client";

import { useCallback, useState } from "react";
import { Prompt } from "./components/prompt";
import { Runner } from "./components/runner";
import { Result } from "./components/result";
import { matchQuery, type DemoResult } from "./lib/demo-results";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; query: string; pending: DemoResult }
  | { kind: "done"; query: string; result: DemoResult };

/**
 * Vantage — the working prototype.
 *
 * State machine (one and only):
 *   idle → running (user hit "Ask")
 *   running → done (pipeline runner finished)
 *   done → idle   (user hit "Ask another")
 *
 * One question at a time. The pipeline is visible while it runs. The answer
 * carries its own evidence. If the matcher can't find a candidate above
 * threshold, `matchQuery` returns the insufficient-evidence fixture — which
 * is the product's correct behaviour, not an error state.
 */
export default function Home() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const handleAsk = useCallback((query: string) => {
    const pending = matchQuery(query);
    // If the pending result has no query baked in (insufficient fallback) it gets
    // populated by matchQuery; otherwise the fixture's canonical query wins.
    setPhase({ kind: "running", query, pending });
  }, []);

  const handleRunnerDone = useCallback(() => {
    setPhase((p) =>
      p.kind === "running"
        ? { kind: "done", query: p.query, result: p.pending }
        : p
    );
  }, []);

  const handleReset = useCallback(() => {
    setPhase({ kind: "idle" });
  }, []);

  return (
    <main>
      {phase.kind === "idle" && <Prompt onSubmit={handleAsk} />}

      {phase.kind === "running" && (
        <>
          <Prompt compact onSubmit={handleAsk} initialValue={phase.query} />
          <Runner
            query={phase.query}
            result={phase.pending}
            onDone={handleRunnerDone}
          />
        </>
      )}

      {phase.kind === "done" && (
        <>
          <Prompt compact onSubmit={handleAsk} initialValue={phase.query} />
          <Result result={phase.result} onReset={handleReset} />
        </>
      )}
    </main>
  );
}
